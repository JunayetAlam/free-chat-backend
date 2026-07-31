import httpStatus from 'http-status';
import AppError from '../errors/AppError';

const DHAKA_TZ = 'Asia/Dhaka';

export type QuotaSlice = {
  used: number;
  max: number;
  resetsAt: string;
};

export const QUOTA_MAX = {
  profileName: 2,
  profileImage: 2,
  roomName: 2,
  roomImage: 1,
} as const;

/** Calendar date YYYY-MM-DD in Asia/Dhaka */
export const todayInDhaka = (now = new Date()): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DHAKA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
};

/** Next midnight Asia/Dhaka as ISO-like string (+06:00, no DST). */
export const nextResetAtDhaka = (now = new Date()): string => {
  const today = todayInDhaka(now);
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(next.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}T00:00:00+06:00`;
};

export const getQuotaState = (
  count: number,
  day: string | null | undefined,
  max: number,
  now = new Date(),
): QuotaSlice => {
  const today = todayInDhaka(now);
  const used = day === today ? count : 0;
  return {
    used,
    max,
    resetsAt: nextResetAtDhaka(now),
  };
};

export type QuotaBump = {
  count: number;
  day: string;
};

/**
 * Returns the new count/day to persist, or throws if the daily max is already used.
 */
export const assertQuotaAvailable = (
  count: number,
  day: string | null | undefined,
  max: number,
  message: string,
  now = new Date(),
): QuotaBump => {
  const today = todayInDhaka(now);
  const used = day === today ? count : 0;
  if (used >= max) {
    throw new AppError(httpStatus.TOO_MANY_REQUESTS, message, {
      code: 'DAILY_QUOTA',
      quota: {
        used,
        max,
        resetsAt: nextResetAtDhaka(now),
      },
    });
  }
  return { count: used + 1, day: today };
};

export const guestQuotaPayload = (guest: {
  profileNameChangeCount: number;
  profileNameChangeDay: string | null;
  profileImageChangeCount: number;
  profileImageChangeDay: string | null;
}) => ({
  profileName: getQuotaState(
    guest.profileNameChangeCount,
    guest.profileNameChangeDay,
    QUOTA_MAX.profileName,
  ),
  profileImage: getQuotaState(
    guest.profileImageChangeCount,
    guest.profileImageChangeDay,
    QUOTA_MAX.profileImage,
  ),
});

export const roomQuotaPayload = (room: {
  nameChangeCount: number;
  nameChangeDay: string | null;
  imageChangeCount: number;
  imageChangeDay: string | null;
}) => ({
  roomName: getQuotaState(
    room.nameChangeCount,
    room.nameChangeDay,
    QUOTA_MAX.roomName,
  ),
  roomImage: getQuotaState(
    room.imageChangeCount,
    room.imageChangeDay,
    QUOTA_MAX.roomImage,
  ),
});
