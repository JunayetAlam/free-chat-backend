import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { PaymentValidation } from './payment.validation';
import { PaymentServices } from './payment.service';

const router = express.Router();



router.post(
  '/buy-subscription',
  auth('ANY'),
  validateRequest.body(PaymentValidation.buySubscriptionSchema),
  PaymentServices.handleBuySubscription,
);

router.post(
  '/renew-subscription',
  auth('ANY'),
  validateRequest.body(PaymentValidation.renewSubscriptionSchema),
  PaymentServices.handleRenewSubscription,
);

// Get user's active subscriptions
router.get('/active-subscriptions', auth('ANY'), PaymentServices.getUserActiveSubscriptions);

// Payment history and management
router.get('/', auth('ANY'), PaymentServices.getAllPayments);

router.get('/:id', auth('ANY'), PaymentServices.singleTransactionHistory);

router.get('/session/:sessionId', auth('ANY'), PaymentServices.singleTransactionHistoryBySessionId);

router.patch('/:id/cancel', auth('ANY'), PaymentServices.cancelPayment);



export const PaymentRoutes = router;