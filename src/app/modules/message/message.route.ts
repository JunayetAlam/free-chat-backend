import express from 'express';
import { MessageService } from './message.service';
import guestIdentity from '../../middlewares/guestIdentity';

const router = express.Router();

router.get('/', guestIdentity, MessageService.getAllMessages);

export const MessageRoutes = router;
