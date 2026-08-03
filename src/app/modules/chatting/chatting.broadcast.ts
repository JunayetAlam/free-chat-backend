import { WebSocket } from 'ws';
import { WsOutgoingEvent } from './type';
import { send } from './chatting.utils';
import { clients, roomSubscribers } from './chatting.state';
import { prisma } from '../../utils/prisma';
import { logActivity } from '../../utils/activityLogger';

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

/**
 * Drop live room subscription and stamp leftAt. Does not touch lastOpenedAt
 * or membership soft-delete flags.
 */
export const unfocusRoom = async (ws: WebSocket): Promise<void> => {
  const client = clients.get(ws);
  if (!client?.roomId) return;

  const roomId = client.roomId;
  roomSubscribers.get(roomId)?.delete(ws);
  client.roomId = null;

  try {
    await prisma.roomMember.updateMany({
      where: {
        roomId,
        guestId: client.guestId,
      },
      data: { leftAt: new Date() },
    });

    await logActivity({
      action: 'ROOM_LEAVE',
      roomId,
      guestId: client.guestId,
      ip: client.ip,
      userAgent: client.userAgent,
    });
  } catch (error) {
    console.error('[WS] unfocusRoom cleanup failed', error);
  }

  broadcast(roomId, {
    event: 'ROOM_LEAVE',
    payload: {
      roomId,
      guestId: client.guestId,
      message: 'A user left the room',
    },
  });
};
