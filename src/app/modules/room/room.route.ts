import express from 'express';
import { RoomService } from './room.service';
import guestIdentity from '../../middlewares/guestIdentity';
import validateRequest from '../../middlewares/validateRequest';
import { RoomValidation } from './room.validation';
import { uploadMiddleware } from '../Upload/upload.middleware';
import {
  roomArchiveLimiter,
  roomByIdGetLimiter,
  roomCreateLimiter,
  roomDeleteLimiter,
  roomImageLimiter,
  roomListLimiter,
  roomMembersLimiter,
  roomUpdateLimiter,
} from '../../middlewares/rateLimiters';

const router = express.Router();

router.post('/', guestIdentity, roomCreateLimiter, RoomService.createRoom);
router.get('/', guestIdentity, roomListLimiter, RoomService.getMyRooms);
router.get(
  '/:roomId/members',
  guestIdentity,
  roomMembersLimiter,
  RoomService.getRoomMembers,
);
router.patch(
  '/:roomId',
  guestIdentity,
  roomUpdateLimiter,
  validateRequest.body(RoomValidation.updateRoomSchema),
  RoomService.updateRoom,
);
router.put(
  '/:roomId/image',
  guestIdentity,
  roomImageLimiter,
  uploadMiddleware.single('file'),
  RoomService.updateRoomImage,
);
router.get('/:roomId', roomByIdGetLimiter, RoomService.getRoomById);
router.delete(
  '/:roomId',
  guestIdentity,
  roomDeleteLimiter,
  RoomService.softDeleteRoom,
);
router.patch(
  '/:roomId/archive',
  guestIdentity,
  roomArchiveLimiter,
  RoomService.archiveRoom,
);

export const RoomRoutes = router;
