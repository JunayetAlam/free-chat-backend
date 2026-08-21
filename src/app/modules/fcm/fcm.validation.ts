import { z } from 'zod';

const saveTokenSchema = z.object({
  body: z.object({
    token: z.string().trim().min(1).max(4096),
    enableNotifications: z.boolean().optional(),
  }),
});

const updatePreferenceSchema = z.object({
  body: z.object({
    enabled: z.boolean(),
  }),
});

const deleteTokenSchema = z.object({
  body: z.object({
    token: z.string().trim().min(1).max(4096),
  }),
});

export const FcmValidation = {
  saveTokenSchema,
  updatePreferenceSchema,
  deleteTokenSchema,
};
