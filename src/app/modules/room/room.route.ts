import express from 'express';
import { RoomService } from './room.service';
const router = express.Router();

router.post('/', RoomService.createRoom);
router.get('/', RoomService.getAllRooms);
router.get('/:roomId', RoomService.getRoomById);
router.delete('/:roomId', RoomService.deleteRoom);

export const RoomRoutes = router;
