import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { Secret } from 'jsonwebtoken';
import config from '../../config';
import { generateFreeChatToken, GuestTokenPayload } from './generateFreeChatToken';
import { verifyToken } from './verifyToken';

const isProd = config.env === 'production';

const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
};

const guestIdFromJwtCookies = (req: Request): string | null => {
  const token = req.cookies?.token as string | undefined;
  const refreshToken = req.cookies?.refreshToken as string | undefined;

  if (token) {
    try {
      const decoded = verifyToken(token, config.jwt.access_secret as Secret);
      if (decoded.guestId) return String(decoded.guestId);
    } catch {
      // ignore
    }
  }

  if (refreshToken) {
    try {
      const decoded = verifyToken(
        refreshToken,
        config.jwt.refresh_secret as Secret,
      );
      if (decoded.guestId) return String(decoded.guestId);
    } catch {
      // ignore
    }
  }

  return null;
};

/** Resolve guest id: guestId cookie → JWT cookie → optional header → generate new */
export const resolveGuestId = (req: Request): string => {
  const fromCookie =
    typeof req.cookies?.guestId === 'string' ? req.cookies.guestId.trim() : '';
  if (fromCookie) return fromCookie;

  const fromJwt = guestIdFromJwtCookies(req);
  if (fromJwt) return fromJwt;

  const header = req.headers['x-guest-id'];
  if (typeof header === 'string' && header.trim()) return header.trim();

  return randomUUID();
};

export const setGuestCookies = (
  res: Response,
  payload: GuestTokenPayload,
) => {
  const accessToken = generateFreeChatToken(
    payload,
    config.jwt.access_secret as Secret,
    (config.jwt.access_expires_in as any) || '1d',
  );

  const refreshToken = generateFreeChatToken(
    payload,
    config.jwt.refresh_secret as Secret,
    (config.jwt.refresh_expires_in as any) || '7d',
  );

  res.cookie('guestId', payload.guestId, {
    ...cookieOptions,
    maxAge: 365 * 24 * 60 * 60 * 1000,
  });

  res.cookie('token', accessToken, {
    ...cookieOptions,
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return { accessToken, refreshToken };
};

/** @deprecated use setGuestCookies */
export const setGuestTokenCookies = setGuestCookies;
