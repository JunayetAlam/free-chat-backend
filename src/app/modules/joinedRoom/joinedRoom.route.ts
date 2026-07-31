import express from 'express';
import { JoinedRoomService } from './joinedRoom.service';
import guestIdentity from '../../middlewares/guestIdentity';
import {
  joinedRoomArchiveLimiter,
  joinedRoomDeleteLimiter,
  joinedRoomsListLimiter,
} from '../../middlewares/rateLimiters';

const router = express.Router();

router.get(
  '/',
  guestIdentity,
  joinedRoomsListLimiter,
  JoinedRoomService.getAllJoinedRooms,
);
router.patch(
  '/:roomId/archive',
  guestIdentity,
  joinedRoomArchiveLimiter,
  JoinedRoomService.archiveJoinedRoom,
);
router.delete(
  '/:roomId',
  guestIdentity,
  joinedRoomDeleteLimiter,
  JoinedRoomService.softDeleteJoinedRoom,
);

export const JoinedRoomRoutes = router;
