import httpStatus from 'http-status';
import { User, UserRoleEnum, UserStatus } from '@prisma/client';
import QueryBuilder from '../../builder/QueryBuilder';
import { prisma } from '../../utils/prisma';
import { Request } from 'express';
import AppError from '../../errors/AppError';
import { JwtPayload } from 'jsonwebtoken';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { deleteFromMinIO, uploadToMinIO } from '../Upload/uploadToMinio';

const getAllUsers = catchAsync(async (req, res) => {
  const user = req.user;
  const query: Record<string, unknown> = req.query;

  if (user.role !== 'SUPERADMIN') {
    query.isDeleted = false;
  }

  const usersQuery = new QueryBuilder<typeof prisma.user>(prisma.user, query);
  const result = await usersQuery
    .search(['firstName', 'lastName', 'email'])
    .filter()
    .sort()
    .customFields({
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      profilePhoto: true,
      ...(user.role === 'SUPERADMIN' && { isDeleted: true, createdAt: true, updatedAt: true, status: true, }),
    })
    .exclude()
    .paginate()
    .execute();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Users retrieved successfully',
    ...result
  });
});

const getMyProfile = catchAsync(async (req, res) => {
  const id = req.user.id;
  const role = req.user.role;

  const Profile = await prisma.user.findUniqueOrThrow({
    where: {
      id: id,
    },
    include: {
      ...(role !== 'SUPERADMIN' && {
        payments: {
          where: {
            paymentType: 'SUBSCRIPTION',
            paymentStatus: 'SUCCESS',
            endAt: {
              gte: new Date(),
            },
          },
          select: {
            id: true,
            paymentStatus: true,
            endAt: true,
            subscriptionPackageId: true
          }
        },
      })
    }
  });

  if (role === 'SUPERADMIN') {
    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'Profile retrieved successfully',
      data: { ...Profile, hideSubscription: false }
    });
    return;
  }

  const payments = Profile.payments
  const exactPayment = payments?.filter(item => item.paymentStatus === 'SUCCESS')[0]
  const isVerified = new Date(exactPayment?.endAt || '') >= new Date();
  const result = {
    ...Profile,
    payments: undefined,
    isPaid: isVerified,
    subscriptionPackageId: exactPayment?.subscriptionPackageId || '',
    endAt: exactPayment?.endAt || null,
    hideSubscription: false
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Profile retrieved successfully',
    data: result,
  });
});

const getUserDetails = catchAsync(async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  const result = await prisma.user.findUniqueOrThrow({
    where: {
      id,
      ...(user.role !== 'SUPERADMIN' && { isDeleted: false })
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      profilePhoto: true,
      ...(user.role === 'SUPERADMIN' && { isDeleted: true, createdAt: true, updatedAt: true, status: true, }),
    },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User details retrieved successfully',
    data: result,
  });
});

const updateMyProfile = catchAsync(async (req: Request, res) => {
  const id = req.user.id;
  const payload = req.body;
  delete payload.email;

  const result = await prisma.user.update({
    where: {
      id
    },
    data: payload
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User profile updated successfully',
    data: result,
  });
});

const updateProfileImage = catchAsync(async (req: Request, res) => {
  const id = req.user.id;
  const file = req.file;
  const previousImg = req.user.profilePhoto || '';

  if (file) {
    const location = await uploadToMinIO(file);
    const result = await prisma.user.update({
      where: {
        id
      },
      data: {
        profilePhoto: location
      }
    });

    if (previousImg) {
      deleteFromMinIO(previousImg);
    }

    req.user.profilePhoto = location;

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'Profile image updated successfully',
      data: result,
    });
    return;
  }

  throw new AppError(httpStatus.NOT_FOUND, 'Please provide image');
});

const updateUserRoleStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const role = req.body.role;

  const result = await prisma.user.update({
    where: {
      id: id,
    },
    data: {
      role: role
    },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User role updated successfully',
    data: result,
  });
});

const updateUserStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const status = req.body.status;

  const result = await prisma.user.update({
    where: {
      id
    },
    data: {
      status
    },
    select: {
      id: true,
      status: true,
      role: true
    },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User status updated successfully',
    data: result,
  });
});

const deleteMyProfileFromDB = catchAsync(async (req, res) => {
  const id = req.user.id;

  await prisma.user.update({
    where: {
      id
    },
    data: {
      isDeleted: true,
      isEmailVerified: false,
      emailVerificationToken: null,
      emailVerificationTokenExpires: null,
      otp: null,
      otpFor: null,
      otpExpiry: null,
      passwordResetToken: null,
      passwordResetTokenExpires: null,
    }
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Account deleted successfully',
    data: { message: 'Account deleted successfully' },
  });
});

const undeletedUser = catchAsync(async (req, res) => {
  const { id } = req.params;

  const result = await prisma.user.update({
    where: { id },
    data: {
      isDeleted: false,
    }
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Account reactivated successfully',
    data: result,
  });
});

export const UserServices = {
  getAllUsers,
  getMyProfile,
  getUserDetails,
  updateMyProfile,
  updateProfileImage,
  updateUserRoleStatus,
  updateUserStatus,
  deleteMyProfileFromDB,
  undeletedUser
};