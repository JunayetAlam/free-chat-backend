import { prisma } from './prisma';

type RecordJoinedRoomInput = {
  roomId: string;
  guestId: string;
  ip?: string;
  userAgent?: string;
};

/** Upsert join history. Re-join after soft-delete restores the history entry. */
export const recordJoinedRoom = async ({
  roomId,
  guestId,
  ip,
  userAgent,
}: RecordJoinedRoomInput) => {
  const now = new Date();

  return prisma.joinedRoom.upsert({
    where: {
      roomId_guestId: { roomId, guestId },
    },
    create: {
      roomId,
      guestId,
      joinIp: ip,
      userAgent,
      firstJoinedAt: now,
      lastJoinedAt: now,
    },
    update: {
      lastJoinedAt: now,
      ...(ip !== undefined ? { joinIp: ip } : {}),
      ...(userAgent !== undefined ? { userAgent } : {}),
      isDeleted: false,
      deletedAt: null,
      isArchived: false,
      archivedAt: null,
    },
  });
};
