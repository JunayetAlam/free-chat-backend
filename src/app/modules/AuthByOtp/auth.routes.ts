import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { authValidation } from './auth.validation';
import auth from '../../middlewares/auth';
import { AuthServices } from './auth.service';

const router = express.Router();

// POST /auth/login
router.post(
  '/login',
  validateRequest.body(authValidation.loginUser),
  AuthServices.loginUser
);

// POST /auth/register
router.post(
  '/register',
  validateRequest.body(authValidation.registerUser),
  AuthServices.registerUser
);
router.post(
  '/refresh-token',
  auth('ANY'),
  AuthServices.refreshToken
);

// POST /auth/verify-email
router.post(
  '/verify-email',
  validateRequest.body(authValidation.verifyEmail),
  AuthServices.verifyEmail
);

// POST /auth/resend-verification-otp
router.post(
  '/resend-verification-otp',
  validateRequest.body(authValidation.resendOtp),
  AuthServices.resendVerificationOtpToNumber
);

// PATCH /auth/change-password (requires auth)
router.patch(
  '/change-password',
  auth('ANY'),
  validateRequest.body(authValidation.changePassword),
  AuthServices.changePassword
);

// POST /auth/forget-password
router.post(
  '/forget-password',
  validateRequest.body(authValidation.forgetPassword),
  AuthServices.forgetPassword
);

// POST /auth/verify-forgot-password-otp
router.post(
  '/verify-forgot-password-otp',
  validateRequest.body(authValidation.verifyForgotOtp),
  AuthServices.verifyForgotPassOtp
);

// POST /auth/reset-password
router.post(
  '/reset-password',
  validateRequest.body(authValidation.resetPassword),
  AuthServices.resetPassword
);

export const AuthByOtpRouters = router;