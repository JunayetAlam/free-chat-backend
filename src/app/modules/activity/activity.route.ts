import express from 'express';
import { ActivityService } from './activity.service';
import guestIdentity from '../../middlewares/guestIdentity';

const router = express.Router();

router.get('/', guestIdentity, ActivityService.getAllActivityLogs);

export const ActivityRoutes = router;
