import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { messageStore } from './chatting.message-store';
import { chattingValidation } from './chatting.validation';
import { chattingRequestValidation } from './chatting.validate.request';
import { findSingleRoom, send, sendError } from './chatting.utils';
import { broadcast, broadcastAll, joinRoom } from './chatting.broadcast';
import { clients } from './chatting.state';

export const handleRoomJoin = async (
  ws: WebSocket,
  payload: unknown,
): Promise<void> => {
  const data = await chattingRequestValidation(
    chattingValidation.wsRoomJoinSchema,
    payload,
    sendError,
    ws,
  );
  const roomId = data?.roomId;
  if (!roomId) {
    sendError(ws, 'Invalid event structure');
    return;
  }

  const room = await findSingleRoom(roomId, ws);
  if (!room) {
    sendError(ws, 'Room not found');
    return;
  }

  joinRoom(ws, roomId);

  const history = messageStore.getMessages(roomId);
  send(ws, {
    event: 'MESSAGE_HISTORY',
    payload: { roomId, messages: history },
  });

  const client = clients.get(ws)!;
  broadcast(
    roomId,
    {
      event: 'ROOM_JOIN',
      payload: {
        roomId,
        ip: client.deviceId,
        message: 'A user joined the room',
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

  const room = await findSingleRoom(roomId, ws);
  if (!room) {
    sendError(ws, 'Room not found');
    return;
  }

  const message = messageStore.addMessage({
    id: randomUUID(),
    roomId,
    senderDeviceCode: client.deviceId,
    content,
    createdAt: new Date(),
    updatedAt: new Date(),
    isEdited: false,
  });

  broadcastAll(roomId, { event: 'MESSAGE_SEND', payload: { message } });
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

  const updated = messageStore.editMessage(
    roomId,
    messageId,
    client.deviceId,
    content,
  );
  if (!updated) {
    sendError(ws, 'Message not found or you are not the sender');
    return;
  }

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

  const deleted = messageStore.deleteMessage(
    roomId,
    messageId,
    client.deviceId,
  );
  if (!deleted) {
    sendError(ws, 'Message not found or you are not the sender');
    return;
  }

  broadcastAll(roomId, {
    event: 'MESSAGE_DELETE',
    payload: { roomId, messageId },
  });
};

export const eventHandlers = {
  ROOM_JOIN: handleRoomJoin,
  MESSAGE_SEND: handleMessageSend,
  MESSAGE_EDIT: handleMessageEdit,
  MESSAGE_DELETE: handleMessageDelete,
};
