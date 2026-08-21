import { z } from 'zod';

const updateProfileSchema = z.object({
  body: z.object({
    displayName: z.string().trim().min(1).max(40),
  }),
});

const logoutSchema = z.object({
  body: z
    .object({
      token: z.string().trim().min(1).max(4096).optional(),
    })
    .optional()
    .default({}),
});

export const GuestValidation = {
  updateProfileSchema,
  logoutSchema,
};
