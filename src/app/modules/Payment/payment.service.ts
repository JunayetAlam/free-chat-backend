import httpStatus from 'http-status';
import { prisma } from '../../utils/prisma';
import AppError from '../../errors/AppError';
import { subscriptionCheckout } from '../../utils/StripeUtils';
import QueryBuilder from '../../builder/QueryBuilder';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';

const handleBuySubscription = catchAsync(async (req, res) => {
    const subscriptionId = req.body.subscriptionId;
    const userId = req.user.id;
    const email = req.user.email;
    const role = req.user.role;

    const subscription = await prisma.subscription.findUniqueOrThrow({
        where: {
            id: subscriptionId,
            isVisible: true
        }
    });

    if (!subscription) {
        throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found')
    };

    const isHaveSubscription = await prisma.payment.findFirst({
        where: {
            userId,
            paymentStatus: 'SUCCESS',
            endAt: {
                gte: new Date()
            },
            paymentType: 'SUBSCRIPTION'
        }
    });

    if (isHaveSubscription) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Already a subscription available!')
    }

    const isPaymentExist = await prisma.payment.findUnique({
        where: {
            userId_subscriptionPackageId: {
                subscriptionPackageId: subscriptionId,
                userId: userId
            }
        },
        select: {
            id: true,
            userId: true,
            paymentMethodType: true,
            paymentStatus: true
        }
    })

    let url;
    if (isPaymentExist && isPaymentExist.paymentStatus === 'SUCCESS') {
        throw new AppError(httpStatus.BAD_REQUEST, 'Already paid')
    }

    if (isPaymentExist) {
        url = await subscriptionCheckout({
            email: email,
            paymentId: isPaymentExist.id,
            productId: subscription.stripeProductId,
            role: role
        })
    } else {
        const paymentData = await prisma.payment.create({
            data: {
                userId: userId,
                subscriptionPackageId: subscriptionId,
                amount: subscription.price,
                currency: 'sek',
                paymentType: 'SUBSCRIPTION',
            }
        })
        url = await subscriptionCheckout({
            email: email,
            paymentId: paymentData.id,
            productId: subscription.stripeProductId,
            role: role
        })
    }

    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'Subscription payment session created successfully',
        data: { url },
    });
});

const handleRenewSubscription = catchAsync(async (req, res) => {
    const subscriptionId = req.body.subscriptionId;
    const userId = req.user.id;
    const email = req.user.email;
    const role = req.user.role;

    const subscription = await prisma.subscription.findUniqueOrThrow({
        where: {
            id: subscriptionId,
            isVisible: true
        }
    });

    if (!subscription) {
        throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found')
    }

    const expiredPayment = await prisma.payment.findFirst({
        where: {
            userId: userId,
            subscriptionPackageId: subscriptionId,
            paymentType: 'SUBSCRIPTION',
            OR: [
                { paymentStatus: 'EXPIRED' },
                { paymentStatus: 'CANCELLED' },
                {
                    paymentStatus: 'SUCCESS',
                    endAt: { lt: new Date() }
                }
            ]
        },
        orderBy: { createdAt: 'desc' }
    });

    if (!expiredPayment) {
        throw new AppError(httpStatus.BAD_REQUEST, 'No expired subscription found to renew')
    }

    const renewalPayment = await prisma.payment.create({
        data: {
            userId: userId,
            subscriptionPackageId: subscriptionId,
            amount: 10,
            currency: 'sek',
            paymentType: 'SUBSCRIPTION',
        }
    });

    const url = await subscriptionCheckout({
        email: email,
        paymentId: renewalPayment.id,
        productId: subscription.stripeProductId,
        role: role
    });

    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'Subscription renewal session created successfully',
        data: { url },
    });
});

const getUserActiveSubscriptions = catchAsync(async (req, res) => {
    const userId = req.user.id;

    const activeSubscriptions = await prisma.payment.findFirst({
        where: {
            userId: userId,
            paymentType: 'SUBSCRIPTION',
            paymentStatus: 'SUCCESS',
            endAt: { gt: new Date() }
        },
        include: {
            subscriptionPackage: {
                select: {
                    id: true,
                    name: true,
                    stripeProductId: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'Active subscriptions retrieved successfully',
        data: activeSubscriptions || {},
    });
});

const getAllPayments = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const role = req.user.role;
    const query = req.query;

    if (role !== 'SUPERADMIN') {
        query.userId = userId
    }

    const paymentQuery = new QueryBuilder<typeof prisma.transaction>(prisma.transaction, query);
    const result = await paymentQuery
        .search(['user.name', 'user.email', 'vehicle.title', 'stripePaymentId', 'stripeSessionId'])
        .filter()
        .sort()
        .customFields({
            id: true,
            amount: true,
            userId: true,
            cardBrand: true,
            cardExpMonth: true,
            cardExpYear: true,
            cardLast4: true,
            paymentId: true,
            payment: {
                select: {
                    paymentType: true,
                    paymentMethodType: true,
                    paymentStatus: true,
                    stripeCustomerId: true,
                    stripePaymentId: true,
                    startAt: true,
                    endAt: true,
                    stripeSubscriptionId: true,
                    stripeSessionId: true,
                }
            },
            createdAt: true,
            stripeSessionId: true,
            user: {
                select: {
                    profilePhoto: true,
                    firstName: true,
                    lastName: true,
                    email: true
                }
            },
        })
        .exclude()
        .paginate()
        .execute()

    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'Payments retrieved successfully',
        data: result,
    });
});

const singleTransactionHistory = catchAsync(async (req, res) => {
    const query = {
        id: req.params.id,
        ...(req.user.role !== 'SUPERADMIN' && { userId: req.user.id }),
    };

    const result = await prisma.transaction.findUnique({
        where: query,
        select: {
            id: true,
            amount: true,
            userId: true,
            cardBrand: true,
            cardExpMonth: true,
            cardExpYear: true,
            cardLast4: true,
            paymentId: true,
            payment: {
                select: {
                    paymentType: true,
                    paymentMethodType: true,
                    paymentStatus: true,
                    stripeCustomerId: true,
                    stripePaymentId: true,
                    startAt: true,
                    endAt: true,
                    stripeSubscriptionId: true,
                }
            },
            createdAt: true,
            stripeSessionId: true,
            user: {
                select: {
                    profilePhoto: true,
                    firstName: true,
                    lastName: true,
                    email: true
                }
            },
        }
    });

    if (!result) {
        throw new AppError(httpStatus.NOT_FOUND, 'Transaction history not found')
    }

    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'Transaction history retrieved successfully',
        data: result,
    });
});

const singleTransactionHistoryBySessionId = catchAsync(async (req, res) => {
    const query = {
        stripeSessionId: req.params.sessionId,
        ...(req.user.role !== 'SUPERADMIN' && { userId: req.user.id }),
    };

    const result = await prisma.payment.findUnique({
        where: query,
        select: {
            id: true,
            amount: true,
            userId: true,
            paymentMethodType: true,
            createdAt: true,
            stripeCustomerId: true,
            stripePaymentId: true,
            stripeSessionId: true,
            currency: true,
            paymentStatus: true,
            startAt: true,
            endAt: true,
            stripeSubscriptionId: true,
            user: {
                select: {
                    profilePhoto: true,
                    firstName: true,
                    lastName: true,
                    email: true
                }
            },
        }
    });

    if (!result) {
        throw new AppError(httpStatus.NOT_FOUND, 'Transaction history not found')
    }

    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'Transaction history retrieved successfully by sessionId',
        data: result,
    });
});

const cancelPayment = catchAsync(async (req, res) => {
    const id = req.params.id;
    const userId = req.user.id;
    const role = req.user.role;

    const result = await prisma.payment.update({
        where: {
            id,
            ...(role !== 'SUPERADMIN' && { userId })
        },
        data: {
            paymentStatus: 'CANCELLED'
        },
    })

    sendResponse(res, {
        statusCode: httpStatus.OK,
        message: 'Payment cancelled successfully',
        data: result,
    });
});

export const PaymentServices = {
    handleBuySubscription,
    handleRenewSubscription,
    getUserActiveSubscriptions,
    getAllPayments,
    singleTransactionHistory,
    singleTransactionHistoryBySessionId,
    cancelPayment,
};