import { prisma } from './prisma';
import { activeRecordFilter } from './softDelete';

/**
 * Room URLs may use either a Prisma uuid id or an invite code.
 * Invite codes are short (8 chars); uuid ids are 36 chars.
 * Always OR both so either form resolves.
 */
export const roomIdOrInviteWhere = (idOrCode: string) => ({
  OR: [{ id: idOrCode }, { inviteCode: idOrCode }],
});

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
