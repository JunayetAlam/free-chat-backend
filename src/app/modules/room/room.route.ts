import express from 'express';
import { RoomService } from './room.service';
import guestIdentity from '../../middlewares/guestIdentity';
import validateRequest from '../../middlewares/validateRequest';
import { RoomValidation } from './room.validation';
import { uploadMiddleware } from '../Upload/upload.middleware';

const router = express.Router();

router.post('/', guestIdentity, RoomService.createRoom);
router.get('/', guestIdentity, RoomService.getMyRooms);
router.get('/:roomId/members', guestIdentity, RoomService.getRoomMembers);
router.patch(
  '/:roomId',
  guestIdentity,
  validateRequest.body(RoomValidation.updateRoomSchema),
  RoomService.updateRoom,
);
router.put(
  '/:roomId/image',
  guestIdentity,
  uploadMiddleware.single('file'),
  RoomService.updateRoomImage,
);
router.get('/:roomId', RoomService.getRoomById);
router.delete('/:roomId', guestIdentity, RoomService.softDeleteRoom);
router.patch('/:roomId/archive', guestIdentity, RoomService.archiveRoom);

export const RoomRoutes = router;
