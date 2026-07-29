import { WebSocket } from 'ws';
import { clients } from './chatting.state';
import { broadcast } from './chatting.broadcast';
import { send } from './chatting.utils';
import { prisma } from '../../utils/prisma';

export const countGuestSockets = (guestId: string): number => {
  let count = 0;
  for (const client of clients.values()) {
    if (client.guestId === guestId) count += 1;
  }
  return count;
};

export const isGuestOnline = (guestId: string): boolean =>
  countGuestSockets(guestId) > 0;

export const getOnlineGuestIds = (): string[] => {
  const ids = new Set<string>();
  for (const client of clients.values()) {
    ids.add(client.guestId);
  }
  return [...ids];
};

export const getOnlineMemberGuestIds = async (
  roomId: string,
): Promise<string[]> => {
  const members = await prisma.roomMember.findMany({
    where: {
      roomId,
      isDeleted: false,
      isArchived: false,
    },
    select: { guestId: true },
  });

  const online = new Set(getOnlineGuestIds());
  return members
    .map(m => m.guestId)
    .filter(guestId => online.has(guestId));
};

export const sendPresenceSnapshot = async (
  ws: WebSocket,
  roomId: string,
): Promise<void> => {
  const onlineGuestIds = await getOnlineMemberGuestIds(roomId);
  send(ws, {
    event: 'PRESENCE_SNAPSHOT',
    payload: { roomId, onlineGuestIds },
  });
};

export const notifyGuestPresence = async (
  guestId: string,
  isOnline: boolean,
): Promise<void> => {
  const memberships = await prisma.roomMember.findMany({
    where: {
      guestId,
      isDeleted: false,
      isArchived: false,
    },
    select: { roomId: true },
  });

  const roomIds = [...new Set(memberships.map(m => m.roomId))];
  for (const roomId of roomIds) {
    broadcast(roomId, {
      event: 'PRESENCE_UPDATE',
      payload: { guestId, isOnline, roomId },
    });
  }
};

/** Call after the socket is registered in `clients`. Returns true if newly online. */
export const onGuestConnected = async (guestId: string): Promise<boolean> => {
  if (countGuestSockets(guestId) !== 1) return false;
  await notifyGuestPresence(guestId, true);
  return true;
};

/**
 * Call after the socket is removed from `clients`.
 * Returns true if the guest is now fully offline.
 */
export const onGuestDisconnected = async (
  guestId: string,
): Promise<boolean> => {
  if (countGuestSockets(guestId) > 0) return false;
  await notifyGuestPresence(guestId, false);
  return true;
};
