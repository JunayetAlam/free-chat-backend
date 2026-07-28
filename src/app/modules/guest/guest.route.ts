import express from 'express';
import { GuestService } from './guest.service';
import guestIdentity from '../../middlewares/guestIdentity';

const router = express.Router();

router.post('/bootstrap', GuestService.bootstrap);
router.get('/me', guestIdentity, GuestService.me);
router.patch('/me', guestIdentity, GuestService.updateProfile);

export const GuestRoutes = router;
