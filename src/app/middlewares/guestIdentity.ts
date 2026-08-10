import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import AppError from '../errors/AppError';
import {
  issueGuestTokens,
  readGuestAuthFromCookies,
} from '../utils/setGuestTokenCookies';
import { upsertGuest } from '../utils/upsertGuest';
import { getClientIpFromRequest } from '../utils/getClientIp';

/**
 * Require valid access or refresh JWT. Never trusts guestId cookie alone.
 * Rotates tokens only when the request was authenticated via refresh.
 */
const guestIdentity = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const auth = readGuestAuthFromCookies(req);
    if (!auth) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        'Unauthorized: valid guest token required',
        { code: 'SESSION_EXPIRED' },
      );
    }

    const ip = getClientIpFromRequest(req);
    const userAgent = req.headers['user-agent'];

    const guest = await upsertGuest({
      guestId: auth.guestId,
      ip,
      userAgent: typeof userAgent === 'string' ? userAgent : undefined,
    });

    if (auth.source === 'refresh') {
      issueGuestTokens(res, guest.id);
    }

    req.guest = guest;
    req.user = { guestId: guest.id };

    next();
  } catch (error) {
    next(error);
  }
};

export default guestIdentity;
