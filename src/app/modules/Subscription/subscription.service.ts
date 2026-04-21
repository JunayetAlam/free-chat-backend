import httpStatus from 'http-status';
import { getStripeRecurring, stripe } from '../../utils/stripe';
import AppError from '../../errors/AppError';
import { prisma } from '../../utils/prisma';
import { CreateSubscriptionPayload } from './subscription.interface';
import config from '../../../config';
import { updateSingleSubscription } from './update_subscription.service';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';

const createSubscription = catchAsync(async (req, res) => {
    const payload: CreateSubscriptionPayload = req.body;

    const stripeProduct = await stripe.products.create({
        name: payload.name,
        description: `Subscription plan: ${payload.name}`,
        active: payload.active ?? true,
        metadata: {
            websiteId: config.project_name,
            billingCycle: payload.billingCycle,
            createdAt: new Date().toISOString()
        }
    });

    const recurringConfig = getStripeRecurring(payload.billingCycle);
    const stripePrice = await stripe.prices.create({
        product: stripeProduct.id,
        unit_amount: Math.round(payload.price * 100),
        currency: 'sek',
        recurring: recurringConfig,
        active: payload.active ?? true,
        metadata: {
            subscriptionProductId: stripeProduct.id
        }
    });

    await stripe.products.update(stripeProduct.id, {
        default_price: stripePrice.id
    });

    const subscription = await prisma.subscription.create({
        data: {
            name: payload.name,
            price: payload.price,
            billingCycle: payload.billingCycle,
            points: payload.points,
            active: payload.active ?? true,
            isVisible: payload.isVisible ?? true,
            stripeProductId: stripeProduct.id,
            stripePriceId: stripePrice.id,
            stripeActive: payload.active ?? true,
            currency: 'sek'
        },
    });

    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        message: 'Subscription created successfully',
        data: subscription,
    });
});

const getAllSubscriptions = catchAsync(async (req, res) => {
    const onlyIsVisible = false;
    const where = onlyIsVisible ? { isVisible: true, isDeleted: false } : { isDeleted: false };

    const subscriptions = await prisma.subscription.findMany({
        where,
        orderBy: { createdAt: 'desc' }
    });

    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'All subscriptions retrieved successfully',
        data: subscriptions,
    });
});

const getAllVisibleSubscriptions = catchAsync(async (req, res) => {
    const onlyIsVisible = true;
    const where = onlyIsVisible ? { isVisible: true, isDeleted: false } : { isDeleted: false };

    const subscriptions = await prisma.subscription.findMany({
        where,
        orderBy: { createdAt: 'desc' }
    });

    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'Visible subscriptions retrieved successfully',
        data: subscriptions,
    });
});

const getSingleSubscription = catchAsync(async (req, res) => {
    const { id } = req.params;
    const includeAdminData = false;

    const subscription = await prisma.subscription.findUniqueOrThrow({
        where: {
            id,
            ...(!includeAdminData && {
                isVisible: true,
            })
        },
    });

    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'Subscription retrieved successfully',
        data: subscription,
    });
});

const getSingleSubscriptionWithAdminData = catchAsync(async (req, res) => {
    const { id } = req.params;
    const includeAdminData = true;

    const subscription = await prisma.subscription.findUniqueOrThrow({
        where: {
            id,
            ...(!includeAdminData ? {
                isVisible: true,
            } : {})
        },
    });

    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'Subscription with admin data retrieved successfully',
        data: subscription,
    });
});

const updateSubscription = catchAsync(async (req, res) => {
    const { id } = req.params;
    const payload = req.body;

    const result = await updateSingleSubscription(id, payload);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'Subscription updated successfully',
        data: result,
    });
});

const deleteSubscription = catchAsync(async (req, res) => {
    const { id } = req.params;

    const existingSubscription = await prisma.subscription.findUnique({
        where: { id }
    });

    if (!existingSubscription) {
        throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found');
    }

    await stripe.products.update(existingSubscription.stripeProductId, {
        active: false
    });

    const prices = await stripe.prices.list({ product: existingSubscription.stripeProductId });
    for (const price of prices.data) {
        if (price.active) {
            await stripe.prices.update(price.id, { active: false });
        }
    }

    const deletedSubscription = await prisma.subscription.update({
        where: { id },
        data: {
            isDeleted: true
        }
    });

    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'Subscription deleted successfully',
        data: {
            message: 'Subscription deleted successfully',
            id: deletedSubscription.id
        },
    });
});

const syncSubscriptions = catchAsync(async (req, res) => {
    const subscriptions = await prisma.subscription.findMany({
        where: { stripeActive: true }
    });

    for (const sub of subscriptions) {
        const stripeProduct = await stripe.products.retrieve(sub.stripeProductId);

        if (!stripeProduct.active && sub.active) {
            await prisma.subscription.update({
                where: { id: sub.id },
                data: {
                    active: false,
                    stripeActive: false,
                    isVisible: false
                },
            });
        }
    }

    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'Subscriptions synced with Stripe successfully',
        data: { message: 'Sync completed successfully' },
    });
});

export const SubscriptionServices = {
    createSubscription,
    getAllSubscriptions,
    getAllVisibleSubscriptions,
    getSingleSubscription,
    getSingleSubscriptionWithAdminData,
    updateSubscription,
    deleteSubscription,
    syncSubscriptions,
};