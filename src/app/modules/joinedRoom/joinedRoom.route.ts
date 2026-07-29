import express from 'express';
import { JoinedRoomService } from './joinedRoom.service';
import guestIdentity from '../../middlewares/guestIdentity';

const router = express.Router();

router.get('/', guestIdentity, JoinedRoomService.getAllJoinedRooms);
router.patch(
  '/:roomId/archive',
  guestIdentity,
  JoinedRoomService.archiveJoinedRoom,
);
router.delete('/:roomId', guestIdentity, JoinedRoomService.softDeleteJoinedRoom);

export const JoinedRoomRoutes = router;
