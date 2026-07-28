import express from 'express';
import { RoomService } from './room.service';
import guestIdentity from '../../middlewares/guestIdentity';

const router = express.Router();

router.post('/', guestIdentity, RoomService.createRoom);
router.get('/', guestIdentity, RoomService.getMyRooms);
router.get('/:roomId/members', guestIdentity, RoomService.getRoomMembers);
router.get('/:roomId', RoomService.getRoomById);
router.delete('/:roomId', guestIdentity, RoomService.softDeleteRoom);
router.patch('/:roomId/archive', guestIdentity, RoomService.archiveRoom);

export const RoomRoutes = router;
