import { Request, Response } from 'express';
import { Secret } from 'jsonwebtoken';
import config from '../../config';
import { generateFreeChatToken } from './generateFreeChatToken';
import { verifyToken } from './verifyToken';

const isProd = config.env === 'production';

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;

const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
};

export type GuestAuthSource = 'access' | 'refresh';

export type GuestAuthFromCookies = {
  guestId: string;
  source: GuestAuthSource;
};

const accessExpiresIn = () =>
  (config.jwt.access_expires_in as string | undefined) || '1h';

const refreshExpiresIn = () =>
  (config.jwt.refresh_expires_in as string | undefined) || '7d';

const tryGuestIdFromToken = (
  token: string | undefined,
  secret: Secret,
): string | null => {
  if (!token?.trim()) return null;
  try {
    const decoded = verifyToken(token, secret);
    return decoded.guestId ? String(decoded.guestId) : null;
  } catch {
    return null;
  }
};

/**
 * Read guest identity from JWT cookies only.
 * Does not trust plain guestId cookie or x-guest-id.
 */
export const readGuestAuthFromCookies = (
  req: Request,
): GuestAuthFromCookies | null => {
  const accessToken = req.cookies?.token as string | undefined;
  const refreshToken = req.cookies?.refreshToken as string | undefined;

  const fromAccess = tryGuestIdFromToken(
    accessToken,
    config.jwt.access_secret as Secret,
  );
  if (fromAccess) {
    return { guestId: fromAccess, source: 'access' };
  }

  const fromRefresh = tryGuestIdFromToken(
    refreshToken,
    config.jwt.refresh_secret as Secret,
  );
  if (fromRefresh) {
    return { guestId: fromRefresh, source: 'refresh' };
  }

  return null;
};

/** Issue access + refresh JWTs and set HttpOnly cookies (guestId is non-authoritative). */
export const issueGuestTokens = (
  res: Response,
  guestId: string,
): { accessToken: string; refreshToken: string } => {
  const accessToken = generateFreeChatToken(
    { guestId },
    config.jwt.access_secret as Secret,
    accessExpiresIn() as any,
  );

  const refreshToken = generateFreeChatToken(
    { guestId },
    config.jwt.refresh_secret as Secret,
    refreshExpiresIn() as any,
  );

  res.cookie('guestId', guestId, {
    ...cookieOptions,
    maxAge: 7 * MS_DAY,
  });

  res.cookie('token', accessToken, {
    ...cookieOptions,
    maxAge: MS_HOUR,
  });

  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: 7 * MS_DAY,
  });

  return { accessToken, refreshToken };
};

/** @deprecated use issueGuestTokens */
export const setGuestCookies = (
  res: Response,
  payload: { guestId: string },
) => issueGuestTokens(res, payload.guestId);

/** @deprecated use setGuestCookies / issueGuestTokens */
export const setGuestTokenCookies = setGuestCookies;
