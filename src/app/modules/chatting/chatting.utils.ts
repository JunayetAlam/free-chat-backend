import { IncomingMessage } from 'http';
import { WebSocket } from 'ws';
import { parse as parseCookie } from 'cookie';
import { Secret } from 'jsonwebtoken';
import { ApiResponse, ConversationListItem, WsOutgoingEvent } from './type';
import { verifyToken } from '../../utils/verifyToken';
import config from '../../../config';
import { getClientIpFromWs } from '../../utils/getClientIp';
import { findActiveRoomByIdOrInvite } from '../../utils/findRoom';
import { prisma } from '../../utils/prisma';
import { activeRecordFilter } from '../../utils/softDelete';
import { clients } from './chatting.state';

export const buildResponse = <T>(
  success: boolean,
  message: string,
  data?: T,
): ApiResponse<T> => ({
  success,
  message,
  ...(data !== undefined && { data }),
});

export const findActiveRoom = async (idOrCode: string) => {
  return findActiveRoomByIdOrInvite(idOrCode);
};

export const send = (ws: WebSocket, event: WsOutgoingEvent): void => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
};

export const sendError = (ws: WebSocket, message: string): void => {
  send(ws, { event: 'ERROR', payload: { message } });
};

export type ConversationLastMessage = NonNullable<
  ConversationListItem['lastMessage']
>;

export const messageSenderInclude = {
  sender: {
    select: {
      id: true,
      displayName: true,
      profilePhoto: true,
    },
  },
} as const;

export const resolveLiveSenderDisplayName = (message: {
  senderDisplayName: string;
  sender?: { displayName: string | null } | null;
}): string => {
  const live = message.sender?.displayName?.trim();
  return live || message.senderDisplayName;
};

export const getRoomLastMessage = async (
  roomId: string,
): Promise<ConversationLastMessage | null> => {
  const lastMessage = await prisma.message.findFirst({
    where: {
      roomId,
      ...activeRecordFilter,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      content: true,
      createdAt: true,
      senderDisplayName: true,
      senderGuestId: true,
      sender: {
        select: { displayName: true },
      },
    },
  });

  if (!lastMessage) return null;

  return {
    content: lastMessage.content,
    createdAt: lastMessage.createdAt,
    senderDisplayName: resolveLiveSenderDisplayName(lastMessage),
    senderGuestId: lastMessage.senderGuestId,
  };
};

const conversationActivityTime = (item: ConversationListItem): number => {
  if (item.lastMessage?.createdAt) {
    return new Date(item.lastMessage.createdAt).getTime();
  }
  // Do not use lastJoinedAt — opening a room must not reorder the list.
  return new Date(item.firstJoinedAt).getTime();
};

/** Durable conversation list from JoinedRoom (not in-memory WS maps). */
export const getConversationsForGuest = async (
  guestId: string,
): Promise<ConversationListItem[]> => {
  const joined = await prisma.joinedRoom.findMany({
    where: {
      guestId,
      isDeleted: false,
      isArchived: false,
      room: { isDeleted: false },
    },
    include: {
      room: {
        select: {
          id: true,
          name: true,
          image: true,
          inviteCode: true,
          creatorGuestId: true,
        },
      },
    },
  });

  const conversations = await Promise.all(
    joined.map(async (row): Promise<ConversationListItem> => {
      const lastMessage = await getRoomLastMessage(row.roomId);

      return {
        roomId: row.roomId,
        name: row.room.name,
        image: row.room.image,
        inviteCode: row.room.inviteCode,
        creatorGuestId: row.room.creatorGuestId,
        firstJoinedAt: row.firstJoinedAt,
        lastJoinedAt: row.lastJoinedAt,
        lastMessage,
      };
    }),
  );

  // Most recently messaged / actioned rooms first (not last opened).
  conversations.sort(
    (a, b) => conversationActivityTime(b) - conversationActivityTime(a),
  );

  return conversations;
};

const getJoinedGuestIds = async (roomId: string): Promise<Set<string>> => {
  const joined = await prisma.joinedRoom.findMany({
    where: {
      roomId,
      isDeleted: false,
      isArchived: false,
    },
    select: { guestId: true },
  });
  return new Set(joined.map(row => row.guestId));
};

/**
 * Deliver a WS event to every connected guest who has joined this room
 * (not only the currently focused room subscribers).
 */
export const broadcastToJoinedMembers = async (
  roomId: string,
  event: WsOutgoingEvent,
): Promise<void> => {
  const guestIds = await getJoinedGuestIds(roomId);
  if (guestIds.size === 0) return;

  for (const client of clients.values()) {
    if (!guestIds.has(client.guestId)) continue;
    send(client.ws, event);
  }
};

/**
 * Sync WS client display names and notify joined members when a guest
 * updates their profile name/photo.
 */
export const broadcastGuestProfileUpdate = async (guest: {
  id: string;
  displayName: string | null;
  profilePhoto: string | null;
}): Promise<void> => {
  const liveName = guest.displayName?.trim() || null;

  for (const client of clients.values()) {
    if (client.guestId !== guest.id) continue;
    if (liveName) client.displayName = liveName;
  }

  const memberships = await prisma.roomMember.findMany({
    where: {
      guestId: guest.id,
      isDeleted: false,
    },
    select: { roomId: true },
  });

  if (memberships.length === 0) return;

  const event: WsOutgoingEvent = {
    event: 'GUEST_PROFILE_UPDATE',
    payload: {
      guestId: guest.id,
      displayName: liveName,
      profilePhoto: guest.profilePhoto,
    },
  };

  const seen = new Set<string>();
  for (const { roomId } of memberships) {
    if (seen.has(roomId)) continue;
    seen.add(roomId);
    await broadcastToJoinedMembers(roomId, event);
  }
};

/** Push sidebar preview / room meta to every connected guest who joined this room. */
export const notifyConversationUpdate = async (
  roomId: string,
  patch: {
    lastMessage?: ConversationLastMessage | null;
    name?: string | null;
    image?: string | null;
  },
): Promise<void> => {
  await broadcastToJoinedMembers(roomId, {
    event: 'CONVERSATION_UPDATE',
    payload: { roomId, ...patch },
  });
};

const getCookies = (req: IncomingMessage) => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return {} as Record<string, string>;
  const cookies = parseCookie(cookieHeader);
  return cookies;
};

export const extractGuestTokenFromWs = (
  req: IncomingMessage,
): { token: string; fromQuery: boolean } | null => {
  try {
    const url = new URL(req.url || '', 'http://localhost');
    const fromQuery = url.searchParams.get('token');
    if (fromQuery?.trim()) {
      return { token: fromQuery.trim(), fromQuery: true };
    }
  } catch {
    // ignore
  }

  const cookies = getCookies(req);
  const fromCookie = cookies.token || cookies.refreshToken || null;
  if (!fromCookie) return null;
  return { token: fromCookie, fromQuery: false };
};

/**
 * Auth via query token (preferred for cross-origin) or cookies.
 * guestId comes from JWT. Cookie guestId mismatch is only enforced when
 * auth is cookie-based — bootstrap Set-Cookie may not be visible yet on
 * the immediate post-bootstrap WS handshake, and multi-tab cookie races
 * would otherwise reject a valid query token.
 */
export const verifyGuestWsAuth = (
  req: IncomingMessage,
): { guestId: string; ip?: string; userAgent?: string } | null => {
  const cookies = getCookies(req);
  const cookieGuestId = cookies.guestId?.trim() || null;

  const extracted = extractGuestTokenFromWs(req);
  if (!extracted) {
    return null;
  }

  const { token, fromQuery } = extracted;

  const tryDecode = (tok: string, secret: Secret) => {
    const decoded = verifyToken(tok, secret);
    return (decoded.guestId as string) || null;
  };

  let tokenGuestId: string | null = null;
  try {
    tokenGuestId = tryDecode(token, config.jwt.access_secret as Secret);
  } catch {
    try {
      tokenGuestId = tryDecode(
        cookies.refreshToken || token,
        config.jwt.refresh_secret as Secret,
      );
    } catch {
      return null;
    }
  }

  if (!tokenGuestId) {
    return null;
  }

  if (!fromQuery && cookieGuestId && cookieGuestId !== tokenGuestId) {
    return null;
  }

  return {
    guestId: tokenGuestId,
    ip: getClientIpFromWs(req),
    userAgent:
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : undefined,
  };
};
