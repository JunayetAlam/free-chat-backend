import express from 'express';
import { MessageService } from './message.service';
import guestIdentity from '../../middlewares/guestIdentity';
import { messagesListLimiter } from '../../middlewares/rateLimiters';

const router = express.Router();

router.get(
  '/',
  guestIdentity,
  messagesListLimiter,
  MessageService.getAllMessages,
);

export const MessageRoutes = router;
