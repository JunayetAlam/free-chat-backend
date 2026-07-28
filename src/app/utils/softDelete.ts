export const softDeleteFields = (guestId?: string, ip?: string) => ({
  isDeleted: true,
  deletedAt: new Date(),
  ...(guestId !== undefined && { deletedByGuestId: guestId }),
  ...(ip !== undefined && { deletedIp: ip }),
});

export const softArchiveFields = (guestId?: string) => ({
  isArchived: true,
  archivedAt: new Date(),
  ...(guestId !== undefined && { archivedByGuestId: guestId }),
});

export const activeRecordFilter = {
  isDeleted: false,
  isArchived: false,
} as const;
