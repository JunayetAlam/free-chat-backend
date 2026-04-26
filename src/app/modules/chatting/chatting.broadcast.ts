import { WebSocket } from 'ws';
import { WsOutgoingEvent } from './type';
import { send } from './chatting.utils';
import { clients, roomSubscribers } from './chatting.state';

export const broadcast = (
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

export const broadcastAll = (roomId: string, event: WsOutgoingEvent): void => {
  const subs = roomSubscribers.get(roomId);
  if (!subs) return;
  subs.forEach(ws => send(ws, event));
};

export const joinRoom = (ws: WebSocket, roomId: string): void => {
  const client = clients.get(ws);
  if (!client) return;

  if (client.roomId) {
    roomSubscribers.get(client.roomId)?.delete(ws);
  }

  client.roomId = roomId;

  if (!roomSubscribers.has(roomId)) {
    roomSubscribers.set(roomId, new Set());
  }
  roomSubscribers.get(roomId)!.add(ws);
};
