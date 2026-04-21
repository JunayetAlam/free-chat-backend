import config from "../../../config";
import { prisma } from "../../utils/prisma";
import { getStripeRecurring, stripe } from "../../utils/stripe";
import { CreateSubscriptionPayload } from "./subscription.interface";

export const updateSingleSubscription = async (id: string, payload: Partial<CreateSubscriptionPayload>) => {
    const existingSubscription = await prisma.subscription.findUniqueOrThrow({
        where: { id }
    });

    if (payload.name || payload.active !== undefined) {
        await stripe.products.update(existingSubscription.stripeProductId, {
            ...(payload.name && { name: payload.name }),
            ...(payload.active !== undefined && { active: payload.active }),
            metadata: {
                websiteId: config.project_name,
                billingCycle: payload.billingCycle || existingSubscription.billingCycle,
                updatedAt: new Date().toISOString()
            }
        });
    }

    let newStripePriceId = existingSubscription.stripePriceId;

    if (payload.price !== undefined || payload.billingCycle !== undefined) {
        const newStripePrice = await stripe.prices.create({
            product: existingSubscription.stripeProductId,
            unit_amount: Math.round((payload.price || existingSubscription.price) * 100),
            currency: 'sek',
            recurring: getStripeRecurring(payload.billingCycle || existingSubscription.billingCycle),
            active: true,
            metadata: {
                subscriptionProductId: existingSubscription.stripeProductId
            }
        });

        // Update product with new default price
        await stripe.products.update(existingSubscription.stripeProductId, {
            default_price: newStripePrice.id
        });

        // Archive old price in Stripe
        await stripe.prices.update(existingSubscription.stripePriceId, {
            active: false
        });

        newStripePriceId = newStripePrice.id;
    }

    // Update subscription in database
    const updatedSubscription = await prisma.subscription.update({
        where: { id },
        data: {
            ...(payload.name && { name: payload.name }),
            ...(payload.price !== undefined && { price: payload.price }),
            ...(payload.billingCycle && { billingCycle: payload.billingCycle }),
            ...(payload.points && { points: payload.points }),
            ...(payload.active !== undefined && { active: payload.active }),
            ...(payload.isVisible !== undefined && { isVisible: payload.isVisible }),
            stripePriceId: newStripePriceId,
            stripeActive: payload.active ?? existingSubscription.active,
        },

    });

    return updatedSubscription;
};