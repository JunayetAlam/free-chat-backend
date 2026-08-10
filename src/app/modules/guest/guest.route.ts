import express from 'express';
import { GuestService } from './guest.service';
import guestIdentity from '../../middlewares/guestIdentity';
import validateRequest from '../../middlewares/validateRequest';
import { GuestValidation } from './guest.validation';
import { uploadMiddleware } from '../Upload/upload.middleware';
import {
  guestBootstrapLimiter,
  guestMeGetLimiter,
  guestProfileImageLimiter,
  guestProfilePatchLimiter,
  guestRefreshLimiter,
} from '../../middlewares/rateLimiters';

const router = express.Router();

router.get('/bootstrap', guestBootstrapLimiter, GuestService.bootstrap);
router.post('/refresh', guestRefreshLimiter, GuestService.refresh);
router.get('/me', guestIdentity, guestMeGetLimiter, GuestService.me);
router.patch(
  '/me',
  guestIdentity,
  guestProfilePatchLimiter,
  validateRequest.body(GuestValidation.updateProfileSchema),
  GuestService.updateProfile,
);
router.put(
  '/me/profile-image',
  guestIdentity,
  guestProfileImageLimiter,
  uploadMiddleware.single('file'),
  GuestService.updateProfileImage,
);

export const GuestRoutes = router;
