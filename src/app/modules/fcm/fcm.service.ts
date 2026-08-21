import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import catchAsync from '../../utils/catchAsync';
import { prisma } from '../../utils/prisma';
import sendResponse from '../../utils/sendResponse';
import { isFcmTokenValid } from '../../utils/sendNotification';

const MAX_FCM_TOKENS_PER_GUEST = 10;

const requireGuestId = (guestId?: string) => {
  if (!guestId) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Unauthorized: valid guest token required',
      { code: 'SESSION_EXPIRED' },
    );
  }
  return guestId;
};

const isUniqueViolation = (error: unknown) =>
  Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002',
  );

const countGuestFcmTokens = async (guestId: string) =>
  prisma.guestFcmToken.count({ where: { guestId } });

const statusFromGuest = async (guest: {
  id: string;
  notificationsEnabled: boolean;
}) => {
  const tokens = await prisma.guestFcmToken.findMany({
    where: { guestId: guest.id },
    select: { token: true },
  });
  const hasFcmToken = tokens.length > 0;
  const validity = await Promise.all(
    tokens.map((row: { token: string }) => isFcmTokenValid(row.token)),
  );
  const fcmTokenValid = validity.some(Boolean);

  return {
    notificationsEnabled: hasFcmToken ? guest.notificationsEnabled : false,
    hasFcmToken,
    fcmTokenValid,
  };
};

const claimFcmToken = async (
  guestId: string,
  token: string,
  options?: { enableNotifications?: boolean },
) => {
  const assign = async () => {
    await prisma.$transaction(async tx => {
      await tx.guestFcmToken.deleteMany({
        where: { token, guestId: { not: guestId } },
      });
      await tx.guestFcmToken.upsert({
        where: { token },
        create: { guestId, token },
        update: { guestId },
      });
      if (options?.enableNotifications) {
        await tx.guest.update({
          where: { id: guestId },
          data: { notificationsEnabled: true },
          select: { id: true },
        });
      }

      const extras = await tx.guestFcmToken.findMany({
        where: { guestId },
        orderBy: { updatedAt: 'desc' },
        skip: MAX_FCM_TOKENS_PER_GUEST,
        select: { id: true },
      });
      if (extras.length > 0) {
        await tx.guestFcmToken.deleteMany({
          where: { id: { in: extras.map((row: { id: string }) => row.id) } },
        });
      }
    });
  };

  try {
    await assign();
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    await assign();
  }
};

const saveToken = catchAsync(async (req, res) => {
  const guestId = requireGuestId(req.guest?.id);
  const token = String(req.body?.token ?? '').trim();
  const enableNotifications = req.body?.enableNotifications === true;

  const existing = await prisma.guest.findUnique({
    where: { id: guestId },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Unauthorized: valid guest token required',
      { code: 'SESSION_EXPIRED' },
    );
  }

  await claimFcmToken(guestId, token, { enableNotifications });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'FCM token saved successfully',
    data: { guestId },
  });
});

const getStatus = catchAsync(async (req, res) => {
  const guest = req.guest;
  if (!guest) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Unauthorized: valid guest token required',
      { code: 'SESSION_EXPIRED' },
    );
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'FCM status fetched successfully',
    data: await statusFromGuest(guest),
  });
});

const updatePreference = catchAsync(async (req, res) => {
  const guestId = requireGuestId(req.guest?.id);
  const enabled = req.body?.enabled === true;

  if (enabled) {
    const existing = await prisma.guest.findUnique({
      where: { id: guestId },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        'Unauthorized: valid guest token required',
        { code: 'SESSION_EXPIRED' },
      );
    }

    const tokenCount = await countGuestFcmTokens(guestId);
    if (tokenCount === 0) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'FCM token is required to enable notifications',
      );
    }
  }

  const guest = await prisma.guest.update({
    where: { id: guestId },
    data: { notificationsEnabled: enabled },
    select: {
      id: true,
      notificationsEnabled: true,
    },
  });

  const hasFcmToken = (await countGuestFcmTokens(guestId)) > 0;

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: enabled
      ? 'Notifications enabled successfully'
      : 'Notifications disabled successfully',
    data: {
      notificationsEnabled: hasFcmToken ? guest.notificationsEnabled : false,
      hasFcmToken,
    },
  });
});

const deleteToken = catchAsync(async (req, res) => {
  const guestId = requireGuestId(req.guest?.id);
  const token = String(req.body?.token ?? '').trim();

  await prisma.guestFcmToken.deleteMany({
    where: { guestId, token },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'FCM token removed successfully',
    data: { guestId },
  });
});

export const FcmService = {
  saveToken,
  getStatus,
  updatePreference,
  deleteToken,
};
