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
import { prisma } from '../../utils/prisma';
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from '../Upload/uploadToCloudinary';
import { broadcastGuestProfileUpdate } from '../chatting/chatting.utils';

const syncRoomMemberDisplayName = async (
  guestId: string,
  displayName: string,
) => {
  await prisma.roomMember.updateMany({
    where: { guestId },
    data: { displayName },
  });
};

const bootstrap = catchAsync(async (req, res) => {
  // Backend owns guest id: cookie → optional header → new UUID
  const guestId = resolveGuestId(req);

  const ip = getClientIpFromRequest(req);
  const userAgent = req.headers['user-agent'];

  const guest = await upsertGuest({
    guestId,
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

  await syncRoomMemberDisplayName(guest.id, displayName);
  await broadcastGuestProfileUpdate({
    id: guest.id,
    displayName: guest.displayName,
    profilePhoto: guest.profilePhoto,
  });

  setGuestCookies(res, { guestId: guest.id });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Guest profile updated successfully',
    data: guest,
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

  const previousImg = req.guest.profilePhoto || '';
  const uploaded = await uploadToCloudinary(file);
  if (!uploaded.Location) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to upload image');
  }

  const guest = await prisma.guest.update({
    where: { id: req.guest.id },
    data: { profilePhoto: uploaded.Location },
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
  });
});

export const GuestService = {
  bootstrap,
  me,
  updateProfile,
  updateProfileImage,
};
