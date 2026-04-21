import { z } from "zod";


const buySubscriptionSchema = z.object({
  body: z.object({
    subscriptionId: z.string().min(1, 'Subscription ID is required'),
  }),
});

const extendSubscriptionSchema = z.object({
  body: z.object({
    subscriptionId: z.string().min(1, 'Stripe subscription ID is required'),
  }),
});

const renewSubscriptionSchema = z.object({
  body: z.object({
    subscriptionId: z.string().min(1, 'Subscription package ID is required'),
  }),
});
const increaseCarLimitSchema = z.object({
  body: z.object({
    total: z.number().min(1),
  })
});

export const PaymentValidation = {
  buySubscriptionSchema,
  extendSubscriptionSchema,
  renewSubscriptionSchema,
  increaseCarLimitSchema
};