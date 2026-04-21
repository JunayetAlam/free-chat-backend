import { BillingCycle } from '@prisma/client';
import z from 'zod';



const createSubscription = z.object({
    body: z.object({
        name: z.string().min(1, "Name is required"),
        price: z.number().positive("Price must be positive"),
        billingCycle: z.enum(BillingCycle),
        points: z.array(z.string()).min(1, "At least one point is required"),
        active: z.boolean().optional().default(true),
        isVisible: z.boolean().optional().default(true),
    }).strict(),
});

const updateSubscription = z.object({
    body: z.object({
        name: z.string().min(1).optional(),
        price: z.number().positive("Price must be positive").optional(),
        billingCycle: z.enum(BillingCycle).optional(),
        points: z.array(z.string()).min(1, "At least one point is required").optional(),
        active: z.boolean().optional(),
        isVisible: z.boolean().optional(),
    }).strict()
});

const getSubscriptions = z.object({
    query: z.object({
        onlyVisible: z.string().transform((val) => val === 'true').optional()
    }).strip()
}).strip();

const getSingleSubscription = z.object({
    params: z.object({
        id: z.string().min(1, "Subscription ID is required")
    }).strip(),
    query: z.object({
        onlyVisible: z.string().transform((val) => val === 'true').optional(),
        includeAdminData: z.string().transform((val) => val === 'true').optional()
    }).strip()
}).strip();

const deleteSubscription = z.object({
    params: z.object({
        id: z.string().min(1, "Subscription ID is required")
    }).strip()
}).strip();



export const subscriptionValidation = {
    createSubscription,
    updateSubscription,
    getSubscriptions,
    getSingleSubscription,
    deleteSubscription,
};