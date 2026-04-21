import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { subscriptionValidation } from './subscription.validation';
import { SubscriptionServices } from './subscription.service';

const router = express.Router();

// Public routes (visible subscriptions)
router.get(
  '/',
  SubscriptionServices.getAllVisibleSubscriptions
);

router.get(
  '/:id',
  SubscriptionServices.getSingleSubscription
);

// Admin routes (require SUPERADMIN authentication)
router.post(
  '/',
  auth('SUPERADMIN'),
  validateRequest.body(subscriptionValidation.createSubscription),
  SubscriptionServices.createSubscription
);

router.get(
  '/admin/all',
  auth('SUPERADMIN'),
  SubscriptionServices.getAllSubscriptions
);

router.get(
  '/admin/:id',
  auth('SUPERADMIN'),
  SubscriptionServices.getSingleSubscriptionWithAdminData
);

router.put(
  '/:id',
  auth('SUPERADMIN'),
  validateRequest.body(subscriptionValidation.updateSubscription),
  SubscriptionServices.updateSubscription
);

router.delete(
  '/:id',
  auth('SUPERADMIN'),
  SubscriptionServices.deleteSubscription
);

router.post(
  '/sync/stripe',
  auth('SUPERADMIN'),
  SubscriptionServices.syncSubscriptions
);

export const SubscriptionRoutes = router;