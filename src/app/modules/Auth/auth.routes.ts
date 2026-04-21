import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { authValidation } from './auth.validation';
import auth from '../../middlewares/auth';
import { AuthServices } from './auth.service';

const router = express.Router();

router.post(
  '/login',
  validateRequest.body(authValidation.loginUser),
  AuthServices.loginUser,
);

router.post(
  '/register',
  validateRequest.body(authValidation.registerUser),
  AuthServices.registerUser,
);

router.post(
  '/verify-email',
  validateRequest.body(authValidation.verifyEmailValidationSchema),
  AuthServices.verifyEmail,
);

router.post(
  '/resend-verification-email',
  validateRequest.body(authValidation.resendVerificationEmailValidationSchema),
  AuthServices.resendUserVerificationEmail,
);

router.post(
  '/change-password',
  auth('ANY'),
  validateRequest.body(authValidation.changePasswordValidationSchema),
  AuthServices.changePassword,
);

router.post(
  '/forget-password',
  validateRequest.body(authValidation.forgetPasswordValidationSchema),
  AuthServices.forgetPassword,
);

router.post(
  '/reset-password',
  validateRequest.body(authValidation.resetPasswordValidationSchema),
  AuthServices.resetPassword,
);

export const AuthRouters = router;