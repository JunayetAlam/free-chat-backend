import * as bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';
import config from '../../../config';
import AppError from '../../errors/AppError';
import { insecurePrisma, prisma } from '../../utils/prisma';
import { User } from '@prisma/client';
import { Response } from 'express';
import jwt from 'jsonwebtoken'
import { generateToken } from '../../utils/generateToken';
import { generateOTP, getOtpStatusMessage, otpExpiryTime } from '../../utils/otp';
import { verifyOtp } from '../../utils/verifyOtp';
import { sendOtp } from '../../utils/sendOtp';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { generateRefreshToken, resendOtpUtil } from './auth.utils';

const loginUser = catchAsync(async (req, res) => {
  const payload = req.body;
  const userData = await insecurePrisma.user.findUniqueOrThrow({
    where: {
      email: payload.email,
    },
  });
  if (userData.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Account has been deleted. Please contact support to reactivate your account');
  }
  if (userData.status === 'BLOCKED') {
    throw new AppError(httpStatus.FORBIDDEN, 'Account has been blocked');
  }
  const isCorrectPassword: Boolean = await bcrypt.compare(
    payload.password,
    userData.password,
  );

  if (!isCorrectPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password incorrect');
  }
  if (userData.role !== 'SUPERADMIN' && !userData.isEmailVerified) {
    const result = await resendOtpUtil(userData.email)
    return result
  }
  const result = await generateRefreshToken(userData.email, userData);
  if (result) {
    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'User logged in successfully',
      data: result,
    });
  }
});


const registerUser = catchAsync(async (req, res) => {
  const payload = req.body;
  if (payload.role == "SUPERADMIN") {
    throw new AppError(httpStatus.NOT_ACCEPTABLE, "User can only pass User and Provider")
  }
  const hashedPassword: string = await bcrypt.hash(payload.password, 12);


  const existingUser = await prisma.user.findFirst({
    where: {
      email: payload.email
    },
    select: {
      id: true,
      email: true,
      isDeleted: true
    },
  });

  if (existingUser) {
    if (existingUser.isDeleted) {
      throw new AppError(httpStatus.CONFLICT, 'User already exists with the email and its deleted. Please contact support to reactivate your account');
    } else {
      throw new AppError(httpStatus.CONFLICT, 'User already exists with the email');
    }

  }

  const otp = generateOTP();
  const userData = {
    ...payload,
    password: hashedPassword,
    otp,
    otpExpiry: otpExpiryTime(),
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        ...userData,
        otpFor: 'USER_VERIFICATION',
      },
    });

    sendOtp({ email: userData.email, otp });

    return { user, otp: otp };
  });

  const result = {
    message: 'Please check your Email to verify your account',
    otp
  }
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: 'User Register Successfully. Check your mail to verify',
    data: result.message,
  });
});

const verifyEmail = catchAsync(async (req, res) => {
  const { email, otp } = req.body;
  const { userData } = await verifyOtp({ email, otp }, 'USER_VERIFICATION');
  await prisma.user.update({
    where: {
      email: userData.email,
    },
    data: {
      otp: null,
      otpExpiry: null,
      isEmailVerified: true,
      otpFor: 'NOT'
    },
    select: {
      id: true,
    }
  });

  const accessToken = await generateToken(
    {
      id: userData.id,
      name: userData.firstName + userData.lastName,
      email: userData.email,
      role: userData.role,
      // isPaid: false
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as SignOptions['expiresIn'],
  );

  const result = {
    id: userData.id,
    name: userData.firstName + userData.lastName,
    email: userData.email,
    role: userData.role,
    accessToken: accessToken,
  };
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Email verified successfully',
    data: result,
  });
});

const resendVerificationOtpToNumber = catchAsync(async (req, res) => {
  const { email } = req.body;
  const result = await resendOtpUtil(email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    data: result,
  });
});

const changePassword = catchAsync(async (req, res) => {
  const { user } = req;
  const payload = req.body;
  const userData = await insecurePrisma.user.findUniqueOrThrow({
    where: {
      email: user.email,
      status: 'ACTIVE',
    },
  });

  if (userData.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Account has been deleted. Please contact support to reactivate your account');
  }

  if (userData.status === 'BLOCKED') {
    throw new AppError(httpStatus.FORBIDDEN, 'Account has been blocked');
  }

  const isCorrectPassword: boolean = await bcrypt.compare(
    payload.oldPassword,
    userData.password,
  );

  if (!isCorrectPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Old Password is incorrect')
  }

  const hashedPassword: string = await bcrypt.hash(payload.newPassword, 12);

  await prisma.user.update({
    where: {
      id: userData.id,
    },
    data: {
      password: hashedPassword,
    },
  });

  const result = {
    message: 'Password changed successfully!',
  };
  sendResponse(res, {
    statusCode: httpStatus.OK,
    data: result,
  });
});

const forgetPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  const user = await insecurePrisma.user.findFirstOrThrow({
    where: {
      email: email,
    },
  });


  if (user.isEmailVerified) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not verified!')
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Account has been deleted. Please contact support to reactivate your account');
  }

  if (user.status === 'BLOCKED') {
    throw new AppError(httpStatus.FORBIDDEN, 'User is blocked');
  }

  // if (user.otpFor === 'FORGOT_PASSWORD' && user.otp && user.otpExpiry && new Date(user.otpExpiry).getTime() > Date.now()) {
  //   const message = getOtpStatusMessage(user.otpExpiry);
  //   throw new AppError(httpStatus.CONFLICT, message)
  // }


  const otp = generateOTP();

  const updatedUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { email: email },
      data: {
        otp,
        otpExpiry: otpExpiryTime(),
        otpFor: 'FORGOT_PASSWORD',
      },
    });
    sendOtp({ email: user.email, otp });


    return {
      message: 'Verify Otp has sent to your email',

    };
  });

  const result = { message: 'Verification otp sent successfully. Please check your inbox.', otp };
  sendResponse(res, {
    statusCode: httpStatus.OK,
    data: result,
  });
});

const verifyForgotPassOtp = catchAsync(async (req, res) => {
  const payload = req.body;

  const { userData } = await verifyOtp(payload, 'FORGOT_PASSWORD')


  const resetToken = generateToken(
    {
      id: userData.id,
      name: userData.firstName + userData.lastName,
      email: userData.email,
      role: userData.role,
      // isPaid: false
    },
    config.jwt.access_secret as Secret,
    '600s',
  );


  // Prisma transaction
  await prisma.user.update({
    where: {
      email: payload.email,
    },
    data: {
      otp: null,
      otpExpiry: null,
      passwordResetToken: resetToken,
      otpFor: 'NOT'
    },
  });

  const result = { resetToken, expireInMinutes: 5 };
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'OTP verified successfully',
    data: result,
  });
});

const resetPassword = catchAsync(async (req, res) => {
  const payload = req.body;
  const token = req.headers.authorization as string;
  if (!token) {
    throw new AppError(httpStatus.FORBIDDEN, 'Token is missing!')
  }

  const userData = await insecurePrisma.user.findFirstOrThrow({
    where: {
      email: payload.email,
    },
  })

  if (userData.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Account has been deleted. Please contact support to reactivate your account');
  }

  if (userData.status === 'BLOCKED') {
    throw new AppError(httpStatus.FORBIDDEN, 'User has blocked')
  }

  if (token !== userData.passwordResetToken) {
    throw new AppError(httpStatus.FORBIDDEN, 'Invalid token')
  }

  const decoded = jwt.verify(token, config.jwt.access_secret as string) as JwtPayload

  if (!decoded || !decoded.exp) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid token');
  }

  if (decoded.email !== payload.email) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are forbidden!')
  }

  const newHashedPassword = await bcrypt.hash(payload.newPassword, Number(config.bcrypt_salt_rounds))

  await prisma.user.update({
    where: {
      email: payload.email
    },
    data: {
      password: newHashedPassword,
      passwordResetToken: null,
      passwordResetTokenExpires: null,
    }
  })

  const result = { message: 'Password reset successfully' };
  sendResponse(res, {
    statusCode: httpStatus.OK,
    data: result,
  });
});

const refreshToken = catchAsync(async (req, res) => {
  const result = await generateRefreshToken(req.user.email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Token Refresh Successfully',
    data: result,
  });
});

export const AuthServices = {
  loginUser,
  registerUser,
  changePassword,
  forgetPassword,
  resetPassword,
  resendVerificationOtpToNumber,
  verifyEmail,
  verifyForgotPassOtp,
  refreshToken
};