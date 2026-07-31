import express from 'express';
import { ActivityService } from './activity.service';
import guestIdentity from '../../middlewares/guestIdentity';
import { activityLogsLimiter } from '../../middlewares/rateLimiters';

const router = express.Router();

router.get(
  '/',
  guestIdentity,
  activityLogsLimiter,
  ActivityService.getAllActivityLogs,
);

export const ActivityRoutes = router;
