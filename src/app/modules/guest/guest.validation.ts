import { z } from 'zod';

const bootstrapSchema = z.object({
  body: z.object({
    displayName: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .optional(),
  }),
});

const updateProfileSchema = z.object({
  body: z.object({
    displayName: z.string().trim().min(1).max(40),
  }),
});

export const GuestValidation = {
  bootstrapSchema,
  updateProfileSchema,
};
