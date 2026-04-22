import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { randomUUID } from 'crypto';
import { messageStore } from './chatting.message-store';

import { WsOutgoingEvent } from './type';
import { chattingValidation } from './chatting.validation';
import { extractIpFromWs, findSingleRoom } from './chatting.utils';

interface ChatClient {
  ws: WebSocket;
  ip: string;
  roomId: string | null;
}

const clients: Map<WebSocket, ChatClient> = new Map();

const roomSubscribers: Map<string, Set<WebSocket>> = new Map();

const send = (ws: WebSocket, event: WsOutgoingEvent): void => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
};

const broadcast = (
  roomId: string,
  event: WsOutgoingEvent,
  exclude?: WebSocket,
): void => {
  const subs = roomSubscribers.get(roomId);
  if (!subs) return;
  subs.forEach(ws => {
    if (ws !== exclude) send(ws, event);
  });
};

const broadcastAll = (roomId: string, event: WsOutgoingEvent): void => {
  const subs = roomSubscribers.get(roomId);
  if (!subs) return;
  subs.forEach(ws => send(ws, event));
};

const sendError = (ws: WebSocket, message: string): void => {
  send(ws, { event: 'ERROR', payload: { message } });
};

const joinRoom = (ws: WebSocket, roomId: string): void => {
  const client = clients.get(ws);
  if (!client) return;

  if (client.roomId) {
    const prevSubs = roomSubscribers.get(client.roomId);
    prevSubs?.delete(ws);
  }

  client.roomId = roomId;

  if (!roomSubscribers.has(roomId)) {
    roomSubscribers.set(roomId, new Set());
  }
  roomSubscribers.get(roomId)!.add(ws);
};

const handleRoomJoin = async (
  ws: WebSocket,
  payload: unknown,
): Promise<void> => {
  const parsed = chattingValidation.wsRoomJoinSchema.safeParse({
    body: payload,
  });
  if (!parsed.success) {
    sendError(ws, parsed.error.message);
    return;
  }

  const {
    body: { roomId },
  } = parsed.data;
  const room = await findSingleRoom(roomId);
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
      payload: { roomId, ip: client.ip, message: 'A user joined the room' },
    },
    ws,
  );
};

const handleMessageSend = async (
  ws: WebSocket,
  payload: unknown,
): Promise<void> => {
  const client = clients.get(ws);
  if (!client) return;

  const parsed = chattingValidation.wsMessageSendSchema.safeParse(payload);
  if (!parsed.success) {
    sendError(ws, parsed.error.message);
    return;
  }

  const { roomId, content } = parsed.data.body;

  if (client.roomId !== roomId) {
    sendError(ws, 'You are not in this room');
    return;
  }

  const room = await findSingleRoom(roomId);
  if (!room) {
    sendError(ws, 'Room not found');
    return;
  }

  const message = messageStore.addMessage({
    id: randomUUID(),
    roomId,
    senderIp: client.ip,
    content,
    createdAt: new Date(),
    updatedAt: new Date(),
    isEdited: false,
  });

  broadcastAll(roomId, { event: 'MESSAGE_SEND', payload: { message } });
};

const handleMessageEdit = async (
  ws: WebSocket,
  payload: unknown,
): Promise<void> => {
  const client = clients.get(ws);
  if (!client) return;

  const parsed = chattingValidation.wsMessageEditSchema.safeParse({
    body: payload,
  });
  if (!parsed.success) {
    sendError(ws, parsed.error.message);
    return;
  }

  const { roomId, messageId, content } = parsed.data.body;

  if (client.roomId !== roomId) {
    sendError(ws, 'You are not in this room');
    return;
  }

  const updated = messageStore.editMessage(
    roomId,
    messageId,
    client.ip,
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

const handleMessageDelete = async (
  ws: WebSocket,
  payload: unknown,
): Promise<void> => {
  const client = clients.get(ws);
  if (!client) return;

  const parsed = chattingValidation.wsMessageDeleteSchema.safeParse({
    body: payload,
  });
  if (!parsed.success) {
    sendError(ws, parsed.error.message);
    return;
  }

  const { roomId, messageId } = parsed.data.body;

  if (client.roomId !== roomId) {
    sendError(ws, 'You are not in this room');
    return;
  }

  const deleted = messageStore.deleteMessage(roomId, messageId, client.ip);

  if (!deleted) {
    sendError(ws, 'Message not found or you are not the sender');
    return;
  }

  broadcastAll(roomId, {
    event: 'MESSAGE_DELETE',
    payload: { roomId, messageId },
  });
};

const eventHandlers: Record<
  string,
  (ws: WebSocket, payload: unknown) => Promise<void>
> = {
  ROOM_JOIN: handleRoomJoin,
  MESSAGE_SEND: handleMessageSend,
  MESSAGE_EDIT: handleMessageEdit,
  MESSAGE_DELETE: handleMessageDelete,
};

export const initWebSocketServer = (server: Server): void => {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const ip = extractIpFromWs(req);

    clients.set(ws, { ws, ip, roomId: null });

    ws.on('message', async raw => {
      let parsed: unknown;

      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        sendError(ws, 'Invalid JSON format');
        return;
      }

      const eventParsed = chattingValidation.wsEventSchema.safeParse({
        body: parsed,
      });
      if (!eventParsed.success) {
        sendError(ws, 'Invalid event structure');
        return;
      }

      const { event, payload } = eventParsed.data;
      const handler = eventHandlers[event];

      if (!handler) {
        sendError(ws, `Unknown event: ${event}`);
        return;
      }

      try {
        await handler(ws, payload);
      } catch (err) {
        console.error(`[WS Error] event=${event}`, err);
        sendError(ws, 'An unexpected error occurred');
      }
    });

    ws.on('close', () => {
      const client = clients.get(ws);
      if (client?.roomId) {
        const subs = roomSubscribers.get(client.roomId);
        subs?.delete(ws);
        broadcast(client.roomId, {
          event: 'ROOM_LEAVE',
          payload: { roomId: client.roomId, message: 'A user left the room' },
        });
      }
      clients.delete(ws);
    });

    ws.on('error', err => {
      console.error(`[WS Client Error] ip=${ip}`, err.message);
    });
  });

  wss.on('error', err => {
    console.error('[WSS Error]', err.message);
  });

  console.log('[WS] WebSocket server initialized on path /ws');
};
