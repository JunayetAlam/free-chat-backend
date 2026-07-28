import { prisma } from './prisma';
import { activeRecordFilter } from './softDelete';

/** Mongo ObjectId is 24 hex chars. Invite codes are not — never pass them as `id`. */
export const isMongoObjectId = (value: string): boolean =>
  /^[a-fA-F0-9]{24}$/.test(value);

export const roomIdOrInviteWhere = (idOrCode: string) => {
  if (isMongoObjectId(idOrCode)) {
    return {
      OR: [{ id: idOrCode }, { inviteCode: idOrCode }],
    };
  }
  return { inviteCode: idOrCode };
};

/** Active = not deleted and not archived (for chat join / live rooms) */
export const findActiveRoomByIdOrInvite = async (idOrCode: string) => {
  return prisma.room.findFirst({
    where: {
      ...roomIdOrInviteWhere(idOrCode),
      ...activeRecordFilter,
    },
  });
};

/** Accessible = not soft-deleted (includes archived, for archive list / delete) */
export const findAccessibleRoomByIdOrInvite = async (idOrCode: string) => {
  return prisma.room.findFirst({
    where: {
      ...roomIdOrInviteWhere(idOrCode),
      isDeleted: false,
    },
  });
};
