import express from 'express';
import { GuestRoutes } from '../modules/guest/guest.route';
import { RoomRoutes } from '../modules/room/room.route';
import { MessageRoutes } from '../modules/message/message.route';
import { ActivityRoutes } from '../modules/activity/activity.route';
import { JoinedRoomRoutes } from '../modules/joinedRoom/joinedRoom.route';
import { AuthByOtpRouters } from '../modules/AuthByOtp/auth.routes';
import { UserRouters } from '../modules/User/user.routes';
import { FcmRoutes } from '../modules/fcm/fcm.route';

const router = express.Router();

const moduleRoutes = [
  {
    path: '/guests',
    route: GuestRoutes,
  },
  {
    path: '/rooms',
    route: RoomRoutes,
  },
  {
    path: '/joined-rooms',
    route: JoinedRoomRoutes,
  },
  {
    path: '/messages',
    route: MessageRoutes,
  },
  {
    path: '/activity-logs',
    route: ActivityRoutes,
  },
  {
    path: '/auth',
    route: AuthByOtpRouters,
  },
  {
    path: '/users',
    route: UserRouters,
  },
  {
    path: '/fcm',
    route: FcmRoutes,
  },
];

moduleRoutes.forEach(route => router.use(route.path, route.route));

export default router;
