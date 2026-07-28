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
  const existing = await prisma.joinedRoom.findUnique({
    where: {
      roomId_guestId: { roomId, guestId },
    },
  });

  const now = new Date();

  if (existing) {
    return prisma.joinedRoom.update({
      where: { id: existing.id },
      data: {
        lastJoinedAt: now,
        joinIp: ip ?? existing.joinIp,
        userAgent: userAgent ?? existing.userAgent,
        isDeleted: false,
        deletedAt: null,
        isArchived: false,
        archivedAt: null,
      },
    });
  }

  return prisma.joinedRoom.create({
    data: {
      roomId,
      guestId,
      joinIp: ip,
      userAgent,
      firstJoinedAt: now,
      lastJoinedAt: now,
    },
  });
};
