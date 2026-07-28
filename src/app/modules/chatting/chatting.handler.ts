import { WebSocket } from 'ws';
import { chattingValidation } from './chatting.validation';
import { chattingRequestValidation } from './chatting.validate.request';
import { findActiveRoom, send, sendError } from './chatting.utils';
import { broadcast, broadcastAll, joinRoom } from './chatting.broadcast';
import { clients } from './chatting.state';
import { prisma } from '../../utils/prisma';
import { upsertGuest } from '../../utils/upsertGuest';
import { logActivity } from '../../utils/activityLogger';
import { activeRecordFilter, softDeleteFields } from '../../utils/softDelete';
import { recordJoinedRoom } from '../../utils/recordJoinedRoom';

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

  const room = await findActiveRoom(data.roomId);
  if (!room) {
    sendError(ws, 'Room not found');
    return;
  }

  const displayName =
    data.displayName?.trim() || client.displayName || undefined;

  const guest = await upsertGuest({
    guestId: client.guestId,
    displayName,
    ip: client.ip,
    userAgent: client.userAgent,
  });

  const resolvedName =
    guest.displayName || `Guest-${client.guestId.slice(0, 6)}`;
  client.displayName = resolvedName;

  const existingMember = await prisma.roomMember.findUnique({
    where: {
      roomId_guestId: {
        roomId: room.id,
        guestId: client.guestId,
      },
    },
  });

  if (existingMember) {
    await prisma.roomMember.update({
      where: { id: existingMember.id },
      data: {
        displayName: resolvedName,
        lastIp: client.ip,
        userAgent: client.userAgent,
        leftAt: null,
        isDeleted: false,
        deletedAt: null,
        isArchived: false,
        archivedAt: null,
      },
    });
  } else {
    await prisma.roomMember.create({
      data: {
        roomId: room.id,
        guestId: client.guestId,
        displayName: resolvedName,
        joinIp: client.ip,
        lastIp: client.ip,
        userAgent: client.userAgent,
      },
    });
  }

  await recordJoinedRoom({
    roomId: room.id,
    guestId: client.guestId,
    ip: client.ip,
    userAgent: client.userAgent,
  });

  joinRoom(ws, room.id);

  const history = await prisma.message.findMany({
    where: {
      roomId: room.id,
      ...activeRecordFilter,
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });

  send(ws, {
    event: 'MESSAGE_HISTORY',
    payload: { roomId: room.id, messages: history },
  });

  await logActivity({
    action: 'MESSAGE_HISTORY_READ',
    roomId: room.id,
    guestId: client.guestId,
    ip: client.ip,
    userAgent: client.userAgent,
    metadata: { count: history.length },
  });

  await logActivity({
    action: 'ROOM_JOIN',
    roomId: room.id,
    guestId: client.guestId,
    ip: client.ip,
    userAgent: client.userAgent,
    metadata: { displayName: resolvedName },
  });

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
  console.log(data, 'data');
  if (!data) {
    sendError(ws, 'Invalid event structure');
    return;
  }

  const { roomId, content } = data;
  console.log(client, 'client');
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
  });

  await logActivity({
    action: 'MESSAGE_CREATE',
    roomId: room.id,
    messageId: message.id,
    guestId: client.guestId,
    ip: client.ip,
    userAgent: client.userAgent,
    metadata: { contentLength: content.length },
  });

  broadcastAll(room.id, { event: 'MESSAGE_SEND', payload: { message } });
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
  });

  await logActivity({
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

  broadcastAll(roomId, {
    event: 'MESSAGE_EDIT',
    payload: { message: updated },
  });
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
  });

  await logActivity({
    action: 'MESSAGE_DELETE',
    roomId,
    messageId,
    guestId: client.guestId,
    ip: client.ip,
    userAgent: client.userAgent,
  });

  broadcastAll(roomId, {
    event: 'MESSAGE_DELETE',
    payload: { roomId, messageId, message: deleted },
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
};
