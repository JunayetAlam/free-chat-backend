import express from 'express';
import guestIdentity from '../../middlewares/guestIdentity';
import validateRequest from '../../middlewares/validateRequest';
import { FcmService } from './fcm.service';
import { FcmValidation } from './fcm.validation';

const router = express.Router();

router.get('/status', guestIdentity, FcmService.getStatus);

router.put(
  '/token',
  guestIdentity,
  validateRequest.body(FcmValidation.saveTokenSchema),
  FcmService.saveToken,
);

router.patch(
  '/preference',
  guestIdentity,
  validateRequest.body(FcmValidation.updatePreferenceSchema),
  FcmService.updatePreference,
);

router.delete(
  '/token',
  guestIdentity,
  validateRequest.body(FcmValidation.deleteTokenSchema),
  FcmService.deleteToken,
);

export const FcmRoutes = router;
