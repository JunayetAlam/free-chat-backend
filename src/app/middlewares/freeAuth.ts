import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../config';
import AppError from '../errors/AppError';
import { verifyToken } from '../utils/verifyToken';
import { setGuestCookies } from '../utils/setGuestTokenCookies';

/**
 * Validates guest JWT cookies. Prefer guestIdentity for routes that also need Guest upsert.
 */
const freeAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.token as string | undefined;
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    const cookieGuestId =
      typeof req.cookies?.guestId === 'string' ? req.cookies.guestId.trim() : '';
    const guestIdHeader = req.headers['x-guest-id'];
    const headerGuestId =
      typeof guestIdHeader === 'string' ? guestIdHeader.trim() : '';

    const issueFromPayload = (guestId: string) => {
      if (headerGuestId && headerGuestId !== guestId) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'Guest token mismatch');
      }
      if (cookieGuestId && cookieGuestId !== guestId) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'Guest cookie mismatch');
      }
      setGuestCookies(res, { guestId });
      req.user = { guestId };
    };

    if (token) {
      try {
        const decoded = verifyToken(token, config.jwt.access_secret as Secret);
        const guestId = decoded.guestId as string;
        if (!guestId) {
          throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid guest token');
        }
        issueFromPayload(guestId);
        return next();
      } catch (error) {
        if (error instanceof AppError) throw error;
        // fall through to refresh
      }
    }

    if (!refreshToken) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const refreshDecoded = verifyToken(
      refreshToken,
      config.jwt.refresh_secret as Secret,
    );
    const guestId = refreshDecoded.guestId as string;
    if (!guestId) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid guest token');
    }

    issueFromPayload(guestId);
    return next();
  } catch (error) {
    next(error);
  }
};

export default freeAuth;
