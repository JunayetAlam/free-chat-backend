import { randomUUID } from 'crypto';
import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../../config';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { upsertGuest } from '../../utils/upsertGuest';
import { getClientIpFromRequest } from '../../utils/getClientIp';
import {
  issueGuestTokens,
  readGuestAuthFromCookies,
} from '../../utils/setGuestTokenCookies';
import { verifyToken } from '../../utils/verifyToken';
import AppError from '../../errors/AppError';
import { prisma } from '../../utils/prisma';
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from '../Upload/uploadToCloudinary';
import { broadcastGuestProfileUpdate } from '../chatting/chatting.utils';
import {
  assertQuotaAvailable,
  guestQuotaPayload,
  QUOTA_MAX,
} from '../../utils/dailyQuota';

const bootstrap = catchAsync(async (req, res) => {
  const auth = readGuestAuthFromCookies(req);
  const guestId = auth?.guestId ?? randomUUID();
  const isNewSession = !auth;

  const ip = getClientIpFromRequest(req);
  const userAgent = req.headers['user-agent'];

  const guest = await upsertGuest({
    guestId,
    ip,
    userAgent: typeof userAgent === 'string' ? userAgent : undefined,
  });

  // Always rotate both tokens on bootstrap so opening the site extends the 7d window.
  const tokens = issueGuestTokens(res, guest.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: isNewSession
      ? 'Guest session created successfully'
      : 'Guest bootstrapped successfully',
    data: {
      guest,
      accessToken: tokens.accessToken,
      isNewSession,
    },
  });
});

const refresh = catchAsync(async (req, res) => {
  const refreshCookie = req.cookies?.refreshToken as string | undefined;
  let guestId: string | null = null;

  if (refreshCookie) {
    try {
      const decoded = verifyToken(
        refreshCookie,
        config.jwt.refresh_secret as Secret,
      );
      guestId = decoded.guestId ? String(decoded.guestId) : null;
    } catch {
      guestId = null;
    }
  }

  if (!guestId) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Guest session expired. Please continue as a new guest.',
      { code: 'SESSION_EXPIRED' },
    );
  }

  const ip = getClientIpFromRequest(req);
  const userAgent = req.headers['user-agent'];

  const guest = await upsertGuest({
    guestId,
    ip,
    userAgent: typeof userAgent === 'string' ? userAgent : undefined,
  });

  const tokens = issueGuestTokens(res, guest.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Guest tokens refreshed successfully',
    data: {
      accessToken: tokens.accessToken,
      guest,
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
    quota: guestQuotaPayload(req.guest),
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

  const currentName = (req.guest.displayName || '').trim();
  const nameChanged = displayName !== currentName;

  let guest = req.guest;

  if (nameChanged) {
    const bump = assertQuotaAvailable(
      req.guest.profileNameChangeCount,
      req.guest.profileNameChangeDay,
      QUOTA_MAX.profileName,
      `Daily profile name limit reached (${QUOTA_MAX.profileName}/day). Try again after reset.`,
    );

    guest = await prisma.guest.update({
      where: { id: req.guest.id },
      data: {
        displayName,
        profileNameChangeCount: bump.count,
        profileNameChangeDay: bump.day,
        lastIp: getClientIpFromRequest(req) ?? req.guest.lastIp,
        userAgent:
          typeof req.headers['user-agent'] === 'string'
            ? req.headers['user-agent']
            : req.guest.userAgent,
        lastSeenAt: new Date(),
      },
    });

    await broadcastGuestProfileUpdate({
      id: guest.id,
      displayName: guest.displayName,
      profilePhoto: guest.profilePhoto,
    });
  }

  // Profile update does not mint tokens unless middleware already rotated on refresh.

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: nameChanged
      ? 'Guest profile updated successfully'
      : 'No profile name change',
    data: guest,
    quota: guestQuotaPayload(guest),
  });
});

const updateProfileImage = catchAsync(async (req, res) => {
  if (!req.guest) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Guest not found');
  }

  const file = req.file;
  if (!file) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Please provide image');
  }

  const bump = assertQuotaAvailable(
    req.guest.profileImageChangeCount,
    req.guest.profileImageChangeDay,
    QUOTA_MAX.profileImage,
    `Daily profile image limit reached (${QUOTA_MAX.profileImage}/day). Try again after reset.`,
  );

  const previousImg = req.guest.profilePhoto || '';
  const uploaded = await uploadToCloudinary(file);
  if (!uploaded.Location) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to upload image');
  }

  const guest = await prisma.guest.update({
    where: { id: req.guest.id },
    data: {
      profilePhoto: uploaded.Location,
      profileImageChangeCount: bump.count,
      profileImageChangeDay: bump.day,
    },
  });

  if (previousImg) {
    await deleteFromCloudinary(previousImg);
  }

  await broadcastGuestProfileUpdate({
    id: guest.id,
    displayName: guest.displayName,
    profilePhoto: guest.profilePhoto,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Guest profile image updated successfully',
    data: guest,
    quota: guestQuotaPayload(guest),
  });
});

export const GuestService = {
  bootstrap,
  refresh,
  me,
  updateProfile,
  updateProfileImage,
};
