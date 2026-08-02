import { WebSocket } from 'ws';
import { chattingValidation } from './chatting.validation';
import { chattingRequestValidation } from './chatting.validate.request';
import {
  broadcastToJoinedMembers,
  findActiveRoom,
  getConversationsForGuest,
  getRoomLastMessage,
  messageSenderInclude,
  notifyConversationUpdate,
  resolveLiveSenderDisplayName,
  send,
  sendError,
} from './chatting.utils';
import { broadcast, joinRoom } from './chatting.broadcast';
import { clients } from './chatting.state';
import { sendPresenceSnapshot } from './chatting.presence';
import { prisma } from '../../utils/prisma';
import { upsertGuest } from '../../utils/upsertGuest';
import { logActivity } from '../../utils/activityLogger';
import { activeRecordFilter, softDeleteFields } from '../../utils/softDelete';
import { recordJoinedRoom } from '../../utils/recordJoinedRoom';

const MESSAGE_PAGE_SIZE = 30;

const fetchMessagePage = async (roomId: string, beforeCreatedAt?: Date) => {
  const rows = await prisma.message.findMany({
    where: {
      roomId,
      ...activeRecordFilter,
      ...(beforeCreatedAt ? { createdAt: { lt: beforeCreatedAt } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: MESSAGE_PAGE_SIZE + 1,
    include: messageSenderInclude,
  });

  const hasMore = rows.length > MESSAGE_PAGE_SIZE;
  const messages = rows.slice(0, MESSAGE_PAGE_SIZE).reverse();
  return { messages, hasMore };
};

export const handleRoomJoin = async (
  ws: WebSocket,
  payload: unknown,
): Promise<void> => {
  const client = clients.get(ws);
  if (!client) return;

  const data = await chattingRequestValidation(
    chattingValidation.wsRoomJoinSchema,
    payload,
    sendError,
    ws,
  );
  if (!data?.roomId) {
    sendError(ws, 'Invalid event structure');
    return;
  }

  // Fast room switches start overlapping joins; only the latest epoch may
  // mutate subscription state or push MESSAGE_HISTORY (avoids URL thrashing).
  const joinEpoch = ++client.joinEpoch;
  const isCurrentJoin = () =>
    clients.get(ws) === client && client.joinEpoch === joinEpoch;

  // Guest row is required for RoomMember FK; room lookup is independent — run both.
  const [room, guest] = await Promise.all([
    findActiveRoom(data.roomId),
    upsertGuest({
      guestId: client.guestId,
      ip: client.ip,
      userAgent: client.userAgent,
    }),
  ]);

  if (!room) {
    sendError(ws, 'Room not found');
    return;
  }

  if (!isCurrentJoin()) return;

  const resolvedName =
    guest.displayName || `Guest-${client.guestId.slice(0, 6)}`;
  client.displayName = resolvedName;

  // Membership write and history read are independent — parallelize so the
  // client gets MESSAGE_HISTORY without waiting on joinedRoom / activity logs.
  const [{ messages: history, hasMore }] = await Promise.all([
    fetchMessagePage(room.id),
    prisma.roomMember.upsert({
      where: {
        roomId_guestId: {
          roomId: room.id,
          guestId: client.guestId,
        },
      },
      create: {
        roomId: room.id,
        guestId: client.guestId,
        joinIp: client.ip,
        lastIp: client.ip,
        userAgent: client.userAgent,
      },
      update: {
        lastIp: client.ip,
        userAgent: client.userAgent,
        leftAt: null,
        isDeleted: false,
        deletedAt: null,
        isArchived: false,
        archivedAt: null,
      },
    }),
  ]);

  if (!isCurrentJoin()) return;

  joinRoom(ws, room.id);

  send(ws, {
    event: 'MESSAGE_HISTORY',
    payload: { roomId: room.id, messages: history, hasMore },
  });

  // Side effects after the client can render — do not block history delivery.
  void recordJoinedRoom({
    roomId: room.id,
    guestId: client.guestId,
    ip: client.ip,
    userAgent: client.userAgent,
  }).catch(error => {
    console.error('[WS] recordJoinedRoom failed', error);
  });

  void logActivity({
    action: 'MESSAGE_HISTORY_READ',
    roomId: room.id,
    guestId: client.guestId,
    ip: client.ip,
    userAgent: client.userAgent,
    metadata: { count: history.length, hasMore },
  });

  void logActivity({
    action: 'ROOM_JOIN',
    roomId: room.id,
    guestId: client.guestId,
    ip: client.ip,
    userAgent: client.userAgent,
    metadata: { displayName: resolvedName },
  });

  if (!isCurrentJoin()) return;

  await sendPresenceSnapshot(ws, room.id);

  if (!isCurrentJoin()) return;

  broadcast(
    room.id,
    {
      event: 'PRESENCE_UPDATE',
      payload: {
        guestId: client.guestId,
        isOnline: true,
        roomId: room.id,
      },
    },
    ws,
  );

  broadcast(
    room.id,
    {
      event: 'ROOM_JOIN',
      payload: {
        roomId: room.id,
        guestId: client.guestId,
        displayName: resolvedName,
        message: `${resolvedName} joined the room`,
      },
    },
    ws,
  );
};

export const handleMessageSend = async (
  ws: WebSocket,
  payload: unknown,
): Promise<void> => {
  const client = clients.get(ws);
  if (!client) return;

  const data = await chattingRequestValidation(
    chattingValidation.wsMessageSendSchema,
    payload,
    sendError,
    ws,
  );
  if (!data) {
    sendError(ws, 'Invalid event structure');
    return;
  }

  const { roomId, content } = data;
  if (client.roomId !== roomId) {
    sendError(ws, 'You are not in this room');
    return;
  }

  const room = await findActiveRoom(roomId);
  if (!room) {
    sendError(ws, 'Room not found');
    return;
  }

  const displayName =
    client.displayName || `Guest-${client.guestId.slice(0, 6)}`;

  const message = await prisma.message.create({
    data: {
      roomId: room.id,
      senderGuestId: client.guestId,
      senderDisplayName: displayName,
      senderIp: client.ip,
      content,
    },
    include: messageSenderInclude,
  });

  void logActivity({
    action: 'MESSAGE_CREATE',
    roomId: room.id,
    messageId: message.id,
    guestId: client.guestId,
    ip: client.ip,
    userAgent: client.userAgent,
    metadata: { contentLength: content.length },
  });

  const roomGuests = await prisma.joinedRoom.findMany({
    where: {
      roomId,
      isDeleted: false,
      isArchived: false,
    },
    select: { guestId: true },
  });
  const guestIds = new Set(roomGuests.map(guest => guest.guestId));

  await broadcastToJoinedMembers({
    event: {
      event: 'MESSAGE_SEND',
      payload: { message },
    },
    guestIds,
  });

  await notifyConversationUpdate({
    patch: {
      lastMessage: {
        content: message.content,
        createdAt: message.createdAt,
        senderDisplayName: resolveLiveSenderDisplayName(message),
        senderGuestId: message.senderGuestId,
      },
    },
    guestIds,
  });
};

export const handleMessageEdit = async (
  ws: WebSocket,
  payload: unknown,
): Promise<void> => {
  const client = clients.get(ws);
  if (!client) return;

  const data = await chattingRequestValidation(
    chattingValidation.wsMessageEditSchema,
    payload,
    sendError,
    ws,
  );
  if (!data) {
    sendError(ws, 'Invalid event structure');
    return;
  }

  const { roomId, messageId, content } = data;
  if (client.roomId !== roomId) {
    sendError(ws, 'You are not in this room');
    return;
  }

  const existing = await prisma.message.findFirst({
    where: {
      id: messageId,
      roomId,
      ...activeRecordFilter,
    },
  });

  if (!existing) {
    sendError(ws, 'Message not found');
    return;
  }

  // Token was validated on WS connect; guestId on connection must match sender
  if (existing.senderGuestId !== client.guestId) {
    sendError(ws, 'You can only edit your own messages');
    return;
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: {
      previousContent: existing.content,
      content,
      isEdited: true,
      editedAt: new Date(),
      editedIp: client.ip,
    },
    include: messageSenderInclude,
  });

  void logActivity({
    action: 'MESSAGE_EDIT',
    roomId,
    messageId,
    guestId: client.guestId,
    ip: client.ip,
    userAgent: client.userAgent,
    metadata: {
      oldContent: existing.content,
      newContent: content,
    },
  });

  const roomGuests = await prisma.joinedRoom.findMany({
    where: {
      roomId,
      isDeleted: false,
      isArchived: false,
    },
    select: { guestId: true },
  });
  const guestIds = new Set(roomGuests.map(guest => guest.guestId));

  await broadcastToJoinedMembers({
    guestIds,
    event: {
      event: 'MESSAGE_EDIT',
      payload: { message: updated },
    },
  });

  const lastMessage = await getRoomLastMessage(roomId);
  await notifyConversationUpdate({ patch: { lastMessage }, guestIds });
};

export const handleMessageDelete = async (
  ws: WebSocket,
  payload: unknown,
): Promise<void> => {
  const client = clients.get(ws);
  if (!client) return;

  const data = await chattingRequestValidation(
    chattingValidation.wsMessageDeleteSchema,
    payload,
    sendError,
    ws,
  );
  if (!data) {
    sendError(ws, 'Invalid event structure');
    return;
  }

  const { roomId, messageId } = data;
  if (client.roomId !== roomId) {
    sendError(ws, 'You are not in this room');
    return;
  }

  const existing = await prisma.message.findFirst({
    where: {
      id: messageId,
      roomId,
      ...activeRecordFilter,
    },
  });

  if (!existing) {
    sendError(ws, 'Message not found');
    return;
  }

  if (existing.senderGuestId !== client.guestId) {
    sendError(ws, 'You can only delete your own messages');
    return;
  }

  const deleted = await prisma.message.update({
    where: { id: messageId },
    data: softDeleteFields(client.guestId, client.ip),
    include: messageSenderInclude,
  });

  void logActivity({
    action: 'MESSAGE_DELETE',
    roomId,
    messageId,
    guestId: client.guestId,
    ip: client.ip,
    userAgent: client.userAgent,
  });

  const roomGuests = await prisma.joinedRoom.findMany({
    where: {
      roomId,
      isDeleted: false,
      isArchived: false,
    },
    select: { guestId: true },
  });
  const guestIds = new Set(roomGuests.map(guest => guest.guestId));

  await broadcastToJoinedMembers({
    guestIds,
    event: {
      event: 'MESSAGE_DELETE',
      payload: { roomId, messageId, message: deleted },
    },
  });

  const lastMessage = await getRoomLastMessage(roomId);
  await notifyConversationUpdate({ patch: { lastMessage }, guestIds });
};

export const handleConversationList = async (
  ws: WebSocket,
  payload: unknown,
): Promise<void> => {
  const client = clients.get(ws);
  if (!client) return;

  const data = await chattingRequestValidation(
    chattingValidation.wsConversationListSchema,
    payload,
    sendError,
    ws,
  );
  if (data === null) {
    sendError(ws, 'Invalid event structure');
    return;
  }

  const conversations = await getConversationsForGuest(client.guestId);
  send(ws, {
    event: 'CONVERSATION_LIST',
    payload: { conversations },
  });
};

export const handleMessageHistoryMore = async (
  ws: WebSocket,
  payload: unknown,
): Promise<void> => {
  const client = clients.get(ws);
  if (!client) return;

  const data = await chattingRequestValidation(
    chattingValidation.wsMessageHistoryMoreSchema,
    payload,
    sendError,
    ws,
  );
  if (!data) {
    sendError(ws, 'Invalid event structure');
    return;
  }

  const { roomId, beforeMessageId } = data;
  if (client.roomId !== roomId) {
    sendError(ws, 'You are not in this room');
    return;
  }

  const room = await findActiveRoom(roomId);
  if (!room) {
    sendError(ws, 'Room not found');
    return;
  }

  const cursor = await prisma.message.findFirst({
    where: {
      id: beforeMessageId,
      roomId: room.id,
      ...activeRecordFilter,
    },
  });

  if (!cursor) {
    sendError(ws, 'Message not found');
    return;
  }

  const { messages, hasMore } = await fetchMessagePage(
    room.id,
    cursor.createdAt,
  );

  send(ws, {
    event: 'MESSAGE_HISTORY_MORE',
    payload: { roomId: room.id, messages, hasMore },
  });

  void logActivity({
    action: 'MESSAGE_HISTORY_READ',
    roomId: room.id,
    guestId: client.guestId,
    ip: client.ip,
    userAgent: client.userAgent,
    metadata: {
      count: messages.length,
      hasMore,
      beforeMessageId,
    },
  });
};

export const eventHandlers: Record<
  string,
  (ws: WebSocket, payload: unknown) => Promise<void>
> = {
  ROOM_JOIN: handleRoomJoin,
  MESSAGE_SEND: handleMessageSend,
  MESSAGE_EDIT: handleMessageEdit,
  MESSAGE_DELETE: handleMessageDelete,
  CONVERSATION_LIST: handleConversationList,
  MESSAGE_HISTORY_MORE: handleMessageHistoryMore,
};
