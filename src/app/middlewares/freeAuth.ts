import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../config';
import AppError from '../errors/AppError';
import { verifyToken } from '../utils/verifyToken';
import { generateFreeChatToken } from '../utils/generateFreeChatToken';

const freeAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.token;
    const refreshToken = req.cookies.refreshToken;
    const deviceUniqueCode = req.cookies.deviceUniqueCode;
    const deviceFingerprint = req.headers.devicefingerprint;

    const createNewTokens = (payload: any) => {
      const newAccessToken = generateFreeChatToken(
        payload,
        config.jwt.access_secret as Secret,
        '15m',
      );

      const newRefreshToken = generateFreeChatToken(
        payload,
        config.jwt.refresh_secret as Secret,
        '7d',
      );

      req.user = payload;
      _res.cookie('token', newAccessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
      });

      _res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
      });
    };

    const validateAndIssue = (decoded: any) => {
      if (!deviceUniqueCode || !deviceFingerprint) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'Device not recognized');
      }

      if (
        decoded.deviceUniqueCode !== deviceUniqueCode ||
        decoded.deviceFingerprint !== deviceFingerprint
      ) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'Device mismatch');
      }

      createNewTokens(decoded);
    };

    if (token) {
      try {
        const decoded = verifyToken(token, config.jwt.access_secret as Secret);
        validateAndIssue(decoded);
        return next();
      } catch {
        // token expired or invalid → try refresh
      }
    }

    if (!refreshToken) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const refreshDecoded = verifyToken(
      refreshToken,
      config.jwt.refresh_secret as Secret,
    );

    validateAndIssue(refreshDecoded);

    return next();
  } catch (error) {
    next(error);
  }
};

export default freeAuth;
