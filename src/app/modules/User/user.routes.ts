import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { userValidation } from './user.validation';
import { uploadMiddleware } from '../Upload/upload.middleware';
import { UserServices } from './user.service';

const router = express.Router();

router.get('/', auth('SUPERADMIN'), UserServices.getAllUsers);
router.get('/me', auth('ANY'), UserServices.getMyProfile);

router.get('/:id', auth('ANY'), UserServices.getUserDetails);

router.put(
  '/update-profile',
  auth('ANY'),
  validateRequest.body(userValidation.updateUser),
  UserServices.updateMyProfile,
);

router.put(
  '/update-profile-image',
  auth('ANY'),
  uploadMiddleware.single('file'),
  UserServices.updateProfileImage,
);

router.put(
  '/user-role/:id',
  auth('SUPERADMIN'),
  validateRequest.body(userValidation.updateUserRoleSchema),
  UserServices.updateUserRoleStatus,
);

router.put(
  '/user-status/:id',
  auth('SUPERADMIN'),
  validateRequest.body(userValidation.updateUserStatus),
  UserServices.updateUserStatus,
);


router.delete(
  '/delete-my-profile',
  auth('USER'),
  UserServices.deleteMyProfileFromDB,
);

router.put(
  '/undelete-user/:id',
  auth('SUPERADMIN'),
  UserServices.undeletedUser,
);

export const UserRouters = router;
