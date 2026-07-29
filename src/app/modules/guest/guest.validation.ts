import { z } from 'zod';

const updateProfileSchema = z.object({
  body: z.object({
    displayName: z.string().trim().min(1).max(40),
  }),
});

export const GuestValidation = {
  updateProfileSchema,
};
