import { z } from 'zod';

const createRoomSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(80).optional(),
    displayName: z.string().trim().min(1).max(40).optional(),
  }),
});

const updateRoomSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(80),
  }),
});

const archiveRoomSchema = z.object({
  params: z.object({
    roomId: z.string().min(1),
  }),
});

export const RoomValidation = {
  createRoomSchema,
  updateRoomSchema,
  archiveRoomSchema,
};
