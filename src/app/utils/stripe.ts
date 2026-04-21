import Stripe from "stripe";
import config from "../../config";

export const stripe = new Stripe(config.stripe.stripe_secret_key as string, {
    apiVersion: '2025-08-27.basil'
})

export const getStripeRecurring = (billingCycle: string): { interval: 'day' | 'week' | 'month' | 'year'; interval_count?: number } => {
    switch (billingCycle) {
        case 'DAILY':
            return { interval: 'day', interval_count: 1 };

        case 'WEEKLY':
            return { interval: 'week', interval_count: 1 };

        case 'BIWEEKLY':
            return { interval: 'week', interval_count: 2 };

        case 'MONTHLY':
            return { interval: 'month', interval_count: 1 };

        case 'YEARLY':
            return { interval: 'year', interval_count: 1 };

        default:
            throw new Error('Invalid billing cycle');
    }
};
