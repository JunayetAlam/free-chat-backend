import express from 'express';
import auth from '../../middlewares/auth';
import { parseBody } from '../../middlewares/parseBody';
import validateRequest from '../../middlewares/validateRequest';
import { AssetValidation } from './asset.validation';
import { uploadMiddleware } from '../Upload/upload.middleware';
import { AssetServices } from './asset.service';
const router = express.Router();

router.post(
  '/upload',
  uploadMiddleware.single('file'),
  auth('ANY'),

  AssetServices.upload
);

router.post(
  '/upload-multiple',
  uploadMiddleware.array('files'),
  auth('ANY'),

  AssetServices.uploadMultiple
);

router.delete(
  '/delete',
  auth('ANY'),
  validateRequest.body(AssetValidation.deleteAssetSchema),
  AssetServices.delete
);

router.delete(
  '/delete-multiple',
  auth('ANY'),
  validateRequest.body(AssetValidation.deleteMultipleAssetsSchema),
  AssetServices.deleteMultiple
);

router.put(
  '/update',
  uploadMiddleware.single('file'),
  auth('ANY'),
  parseBody,
  validateRequest.body(AssetValidation.updateAssetSchema),
  AssetServices.update
);

router.put(
  '/update-multiple',
  uploadMiddleware.array('files'),
  auth('ANY'),

  parseBody,
  validateRequest.body(AssetValidation.updateMultipleAssetsSchema),
  AssetServices.updateMultiple
);

export const AssetRouters = router;
