import express from 'express';
import { JoinedRoomService } from './joinedRoom.service';
import guestIdentity from '../../middlewares/guestIdentity';

const router = express.Router();

router.get('/', guestIdentity, JoinedRoomService.getAllJoinedRooms);
router.delete('/:roomId', guestIdentity, JoinedRoomService.softDeleteJoinedRoom);

export const JoinedRoomRoutes = router;
