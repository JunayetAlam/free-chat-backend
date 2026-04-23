import { z } from 'zod';

const wsRoomJoinSchema = z.object({
  body: z.object({
    roomId: z.string().min(1, 'roomId is required'),
  }),
});

const wsMessageDeleteSchema = z.object({
  body: z.object({
    roomId: z.string().min(1, 'roomId is required'),
    messageId: z.string().min(1, 'messageId is required'),
  }),
});

const wsMessageSendSchema = z.object({
  body: z.object({
    roomId: z.string().min(1, 'roomId is required'),
    content: z
      .string()
      .trim()
      .min(1, 'Message cannot be empty')
      .max(2000, 'Message cannot exceed 2000 characters'),
  }),
});

const wsMessageEditSchema = z.object({
  body: z.object({
    roomId: z.string().min(1, 'roomId is required'),
    messageId: z.string().min(1, 'messageId is required'),
    content: z
      .string()
      .trim()
      .min(1, 'Message cannot be empty')
      .max(2000, 'Message cannot exceed 2000 characters'),
  }),
});

const wsEventSchema = z.object({
  body: z.object({
    event: z.enum([
      'ROOM_JOIN',
      'MESSAGE_SEND',
      'MESSAGE_EDIT',
      'MESSAGE_DELETE',
    ]),
    payload: z.record(z.string(), z.any()),
  }),
});

export const chattingValidation = {
  wsRoomJoinSchema,
  wsMessageSendSchema,
  wsMessageEditSchema,
  wsEventSchema,
  wsMessageDeleteSchema,
};
