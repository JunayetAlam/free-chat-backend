import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { upsertGuest } from '../../utils/upsertGuest';
import { getClientIpFromRequest } from '../../utils/getClientIp';
import {
  resolveGuestId,
  setGuestCookies,
} from '../../utils/setGuestTokenCookies';
import AppError from '../../errors/AppError';

const bootstrap = catchAsync(async (req, res) => {
  // Backend owns guest id: cookie → optional header → new UUID
  const guestId = resolveGuestId(req);

  const displayName =
    typeof req.body?.displayName === 'string'
      ? req.body.displayName.trim()
      : undefined;

  const ip = getClientIpFromRequest(req);
  const userAgent = req.headers['user-agent'];

  const guest = await upsertGuest({
    guestId,
    displayName,
    ip,
    userAgent: typeof userAgent === 'string' ? userAgent : undefined,
  });

  const tokens = setGuestCookies(res, { guestId: guest.id });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Guest bootstrapped successfully',
    data: {
      guest,
      accessToken: tokens.accessToken,
    },
  });
});

const me = catchAsync(async (req, res) => {
  if (!req.guest) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Guest not found');
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Guest fetched successfully',
    data: req.guest,
  });
});

const updateProfile = catchAsync(async (req, res) => {
  if (!req.guest) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Guest not found');
  }

  const displayName = String(req.body.displayName || '').trim();
  if (!displayName) {
    throw new AppError(httpStatus.BAD_REQUEST, 'displayName is required');
  }

  const guest = await upsertGuest({
    guestId: req.guest.id,
    displayName,
    ip: getClientIpFromRequest(req),
    userAgent:
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : undefined,
  });

  setGuestCookies(res, { guestId: guest.id });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Guest profile updated successfully',
    data: guest,
  });
});

export const GuestService = {
  bootstrap,
  me,
  updateProfile,
};
