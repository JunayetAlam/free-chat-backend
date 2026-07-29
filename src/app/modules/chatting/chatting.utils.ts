import { IncomingMessage } from 'http';
import { WebSocket } from 'ws';
import cookieParser from 'cookie';
import { Secret } from 'jsonwebtoken';
import { ApiResponse, ConversationListItem, WsOutgoingEvent } from './type';
import { verifyToken } from '../../utils/verifyToken';
import config from '../../../config';
import { getClientIpFromWs } from '../../utils/getClientIp';
import { findActiveRoomByIdOrInvite } from '../../utils/findRoom';
import { prisma } from '../../utils/prisma';
import { activeRecordFilter } from '../../utils/softDelete';

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
          inviteCode: true,
        },
      },
    },
    orderBy: { lastJoinedAt: 'desc' },
  });

  return Promise.all(
    joined.map(async (row): Promise<ConversationListItem> => {
      const lastMessage = await prisma.message.findFirst({
        where: {
          roomId: row.roomId,
          ...activeRecordFilter,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          content: true,
          createdAt: true,
          senderDisplayName: true,
        },
      });

      return {
        roomId: row.roomId,
        name: row.room.name,
        inviteCode: row.room.inviteCode,
        firstJoinedAt: row.firstJoinedAt,
        lastJoinedAt: row.lastJoinedAt,
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              createdAt: lastMessage.createdAt,
              senderDisplayName: lastMessage.senderDisplayName,
            }
          : null,
      };
    }),
  );
};

const getCookies = (req: IncomingMessage) => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return {} as Record<string, string>;
  const cookies = cookieParser.parseCookie(cookieHeader);
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
    console.warn('[WS] auth failed: no token');
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
      console.warn('[WS] auth failed: token verify error');
      return null;
    }
  }

  if (!tokenGuestId) {
    console.warn('[WS] auth failed: token missing guestId');
    return null;
  }

  if (
    !fromQuery &&
    cookieGuestId &&
    cookieGuestId !== tokenGuestId
  ) {
    console.warn('[WS] auth failed: cookie guestId mismatch', {
      cookieGuestId,
      tokenGuestId,
    });
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
