import { Guest } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { deriveDeviceLabel } from '../utils/deviceLabel';

type UpsertGuestInput = {
  guestId: string;
  displayName?: string;
  ip?: string;
  userAgent?: string;
};

/** Auto dummy name when user has not set one yet, e.g. Guest-a1b2c3 */
export const buildDummyDisplayName = (guestId: string): string => {
  const suffix = guestId.replace(/-/g, '').slice(-6).toLowerCase() || 'user';
  return `Guest-${suffix}`;
};

export const upsertGuest = async ({
  guestId,
  displayName,
  ip,
  userAgent,
}: UpsertGuestInput): Promise<Guest> => {
  const deviceLabel = deriveDeviceLabel(userAgent);
  const now = new Date();
  const trimmedName = displayName?.trim();

  return prisma.guest.upsert({
    where: { id: guestId },
    create: {
      id: guestId,
      displayName: trimmedName || buildDummyDisplayName(guestId),
      createdIp: ip,
      lastIp: ip,
      userAgent,
      deviceLabel,
      lastSeenAt: now,
    },
    update: {
      ...(trimmedName ? { displayName: trimmedName } : {}),
      ...(ip !== undefined ? { lastIp: ip } : {}),
      ...(userAgent !== undefined ? { userAgent } : {}),
      ...(deviceLabel !== undefined ? { deviceLabel } : {}),
      lastSeenAt: now,
      isDeleted: false,
      deletedAt: null,
    },
  });
};
