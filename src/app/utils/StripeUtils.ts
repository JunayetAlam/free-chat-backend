import httpStatus from 'http-status';
import AppError from "../errors/AppError";
import catchAsync from "./catchAsync";
import sendResponse from './sendResponse';
import Stripe from 'stripe';
import { stripe } from './stripe';
import config from '../../config';
import { prisma } from './prisma';
import { PaymentType, UserRoleEnum } from '@prisma/client';

interface CheckoutParams {
    email: string;
    paymentId: string;
}

interface SubscriptionCheckoutParams extends CheckoutParams {
    productId: string;
    role: UserRoleEnum;
}

export const StripeWebHook = catchAsync(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    console.log({ sig, request: req.headers })
    if (!sig) {
        throw new AppError(httpStatus.NOT_FOUND, 'Missing Stripe signature');
    }
    const result = await StripeHook(req.body, sig);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'Webhook processed successfully',
        data: result,
    });
});

const StripeHook = async (rawBody: Buffer, signature: string | string[] | undefined) => {
    console.log({
        rawBody,
        signature,
        stripeWebhook: config.stripe.stripe_webhook
    })
    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(
            rawBody,
            signature as string,
            config.stripe.stripe_webhook as string
        );
    } catch (err) {
        throw new AppError(httpStatus.BAD_REQUEST, `Webhook signature verification failed: ${(err as Error).message}`);
    }

    switch (event.type) {
        case 'invoice.payment_succeeded': {
            const invoice = event.data.object as Stripe.Invoice;
            break;
        }

        case 'payment_intent.succeeded': {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            break;
        }

        case 'payment_intent.payment_failed': {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const sessionId = paymentIntent.metadata?.paymentId;
            if (sessionId) {
                await prisma.payment.update({
                    where: { id: sessionId },
                    data: { paymentStatus: 'FAILED' },
                });
            }
            break;
        }

        case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;

            if (session.mode === 'subscription') {
                if (session?.metadata?.paymentId) {
                    const stripeCustomerId = session.customer as string;
                    await prisma.payment.update({
                        where: { id: session.metadata.paymentId },
                        data: {
                            paymentStatus: 'SUCCESS',
                            stripeSessionId: session.id,
                            stripeCustomerId,
                        },
                    });
                }
            } else if (session.mode === 'payment') {
                await handleCheckoutSessionPayment(session);
            }
            break;
        }

        case 'charge.succeeded': {
            const charge = event.data.object as Stripe.Charge;
            console.log(charge)
            await handleCheckoutSessionPayment(charge);
            break;
        }

        case 'checkout.session.expired': {
            const session = event.data.object as Stripe.Checkout.Session;
            await handleCheckoutSessionCanceledPayment(session);
            break;
        }

        case 'customer.subscription.created': {
            const subscription = event.data.object as Stripe.Subscription;
            await handleSubscriptionPayment(subscription);
            break;
        }

        case 'customer.subscription.updated': {
            const subscription = event.data.object as Stripe.Subscription;
            await updateSubscription(subscription);
            break;
        }

        case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription;
            await handleSubscriptionCanceledPayment(subscription);
            break;
        }

        default: {
            return { status: 'unhandled_event', type: event.type };
        }
    }
};


export const subscriptionCheckout = async ({ email, paymentId, productId, role }: SubscriptionCheckoutParams) => {
    const prices = await stripe.prices.list({ product: productId, limit: 1 });
    if (!prices.data.length) throw new Error('No price found for this product.');
    const priceId = prices.data[0].id;

    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        success_url: `${config.base_url_client}/checkout/complete?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.base_url_client}/checkout/cancel?paymentId=${paymentId}`,
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: email,
        metadata: { paymentId, paymentType: PaymentType.SUBSCRIPTION, role },
        subscription_data: {
            metadata: { paymentId, paymentType: PaymentType.SUBSCRIPTION, role },
        },
    });

    return session.url;
};

const handleCheckoutSessionPayment = async (session: Stripe.Checkout.Session | Stripe.Charge) => {


    const paymentId = session.metadata?.paymentId;
    const paymentType = session.metadata?.paymentType as PaymentType

    if (!paymentId) return null;

    const stripePaymentId = session.payment_intent as string;
    const stripeCustomerId = session.customer as string | undefined;

    const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentId, {
        expand: ['latest_charge.payment_method_details']
    });

    const charge = paymentIntent.latest_charge as Stripe.Charge | null;
    const card = charge?.payment_method_details?.type === 'card'
        ? charge.payment_method_details.card
        : undefined;


    const result = await prisma.payment.update({
        where: { id: paymentId },
        data: {
            paymentStatus: 'SUCCESS',
            stripeSessionId: session.id,
            amount: (session.presentment_details?.presentment_amount || 0) / 100 || undefined,
            stripePaymentId,
            stripeCustomerId,
            paymentMethodType: paymentIntent.payment_method_types?.[0],
          
        },
    });
    await prisma.transaction.create({
        data: {
            amount: result.amount,
            cardBrand: card?.brand,
            cardLast4: card?.last4,
            cardExpMonth: card?.exp_month,
            cardExpYear: card?.exp_year,
            paymentId: result.id,
            userId: result.userId,
            stripeSessionId: session.id
        }
    })

};

const handleSubscriptionPayment = async (subscription: Stripe.Subscription) => {
    const paymentId = subscription.metadata?.paymentId;
    const subscriptionItem = subscription.items.data[0];
    const periodStart = new Date(subscriptionItem.current_period_start * 1000);
    const periodEnd = new Date(subscriptionItem.current_period_end * 1000);
    if (!paymentId) return null;

    const unitAmount = subscriptionItem?.price.unit_amount ?? 0;
    const result = await prisma.payment.update({
        where: { id: paymentId },
        data: {
            endAt: periodEnd,
            startAt: periodStart,
            stripeSubscriptionId: subscription.id,
            amount: unitAmount / 100,
        },
    });

    await prisma.transaction.create({
        data: {
            amount: result.amount,
            paymentId: result.id,
            userId: result.userId,
            stripeSessionId: result.stripeSessionId
        }
    })
};

const handleCheckoutSessionCanceledPayment = async (session: Stripe.Checkout.Session) => {
    const paymentId = session.metadata?.paymentId;
    if (!paymentId) return null;

    await prisma.payment.update({
        where: { id: paymentId },
        data: {
            paymentStatus: 'CANCELLED',
            stripeSessionId: session.id,
        },
    });

    return prisma.payment.findUnique({ where: { id: paymentId } });
};

const handleSubscriptionCanceledPayment = async (subscription: Stripe.Subscription) => {
    const paymentId = subscription.metadata?.paymentId;
    if (!paymentId) return null;

    await prisma.payment.update({
        where: { id: paymentId },
        data: {
            paymentStatus: 'CANCELLED',
            stripeSessionId: subscription.id,
        },
    });

    return prisma.payment.findUnique({ where: { id: paymentId } });
};

const updateSubscription = async (subscription: Stripe.Subscription) => {
    const paymentId = subscription.metadata?.paymentId;
    if (!paymentId) return null;

    const stripeCustomerId = subscription.customer as string | undefined;
    const stripePaymentId = subscription.id;

    let paymentStatus: 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'PENDING' = 'PENDING';
    switch (subscription.status) {
        case 'active':
            paymentStatus = 'SUCCESS';
            break;
        case 'incomplete':
        case 'past_due':
            paymentStatus = 'FAILED';
            break;
        case 'canceled':
            paymentStatus = 'CANCELLED';
            break;
        case 'unpaid':
            paymentStatus = 'EXPIRED';
            break;
        default:
            paymentStatus = 'PENDING';
            break;
    }

    const subscriptionItem = subscription.items.data[0];
    const periodStart = subscriptionItem
        ? new Date(subscriptionItem.current_period_start * 1000)
        : undefined;
    const periodEnd = subscriptionItem
        ? new Date(subscriptionItem.current_period_end * 1000)
        : undefined;

    // Calculate amount considering discount
    const unitAmount = subscriptionItem?.price.unit_amount ?? 0;

    const result = await prisma.payment.update({
        where: { id: paymentId },
        data: {
            paymentStatus,
            stripeSessionId: subscription.id,
            stripePaymentId,
            stripeCustomerId,
            paymentType: 'SUBSCRIPTION',
            amount: unitAmount / 100,
            ...(periodStart && { startAt: periodStart }),
            ...(periodEnd && { endAt: periodEnd }),
        },
    });

    await prisma.transaction.create({
        data: {
            amount: result.amount,
            paymentId: result.id,
            userId: result.userId,
            stripeSessionId: result.id
        }
    })
};
