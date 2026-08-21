import { Guest } from '@prisma/client';

export type PublicGuest = {
  id: string;
  displayName: string | null;
  profilePhoto: string | null;
  deviceLabel: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date;
};

export const toPublicGuest = (guest: Guest): PublicGuest => ({
  id: guest.id,
  displayName: guest.displayName,
  profilePhoto: guest.profilePhoto,
  deviceLabel: guest.deviceLabel,
  createdAt: guest.createdAt,
  updatedAt: guest.updatedAt,
  lastSeenAt: guest.lastSeenAt,
});
