import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../config';
import AppError from '../errors/AppError';
import { verifyToken } from '../utils/verifyToken';
import {
  resolveGuestId,
  setGuestCookies,
} from '../utils/setGuestTokenCookies';
import { upsertGuest } from '../utils/upsertGuest';
import { getClientIpFromRequest } from '../utils/getClientIp';

const guestIdentity = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const guestId = resolveGuestId(req);
    if (!guestId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Guest id missing');
    }

    const token = req.cookies?.token as string | undefined;
    const refreshToken = req.cookies?.refreshToken as string | undefined;

    let tokenGuestId: string | null = null;

    if (token) {
      try {
        const decoded = verifyToken(
          token,
          config.jwt.access_secret as Secret,
        );
        tokenGuestId = (decoded.guestId as string) || null;
      } catch {
        // try refresh below
      }
    }

    if (!tokenGuestId && refreshToken) {
      try {
        const decoded = verifyToken(
          refreshToken,
          config.jwt.refresh_secret as Secret,
        );
        tokenGuestId = (decoded.guestId as string) || null;
      } catch {
        tokenGuestId = null;
      }
    }

    // If JWT exists, it must match cookie/resolved guest id
    if (tokenGuestId && tokenGuestId !== guestId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Guest token mismatch');
    }

    // Prefer JWT guest id when present (cookie may be new/empty edge case)
    const finalGuestId = tokenGuestId || guestId;

    const ip = getClientIpFromRequest(req);
    const userAgent = req.headers['user-agent'];

    const guest = await upsertGuest({
      guestId: finalGuestId,
      ip,
      userAgent: typeof userAgent === 'string' ? userAgent : undefined,
    });

    setGuestCookies(res, { guestId: guest.id });

    req.guest = guest;
    req.user = { guestId: guest.id };

    next();
  } catch (error) {
    next(error);
  }
};

export default guestIdentity;
