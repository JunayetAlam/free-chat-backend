import express from 'express';
import { GuestService } from './guest.service';
import guestIdentity from '../../middlewares/guestIdentity';
import validateRequest from '../../middlewares/validateRequest';
import { GuestValidation } from './guest.validation';
import { uploadMiddleware } from '../Upload/upload.middleware';

const router = express.Router();

router.get('/bootstrap', GuestService.bootstrap);
router.get('/me', guestIdentity, GuestService.me);
router.patch(
  '/me',
  guestIdentity,
  validateRequest.body(GuestValidation.updateProfileSchema),
  GuestService.updateProfile,
);
router.put(
  '/me/profile-image',
  guestIdentity,
  uploadMiddleware.single('file'),
  GuestService.updateProfileImage,
);

export const GuestRoutes = router;
