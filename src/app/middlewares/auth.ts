import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../config';
import AppError from '../errors/AppError';
import { verifyToken } from '../utils/verifyToken';
import { UserRoleEnum } from '@prisma/client';
import { insecurePrisma } from '../utils/prisma';

type TupleHasDuplicate<T extends readonly unknown[]> =
  T extends [infer F, ...infer R]
  ? F extends R[number]
  ? true
  : TupleHasDuplicate<R>
  : false;

type NoDuplicates<T extends readonly unknown[]> =
  TupleHasDuplicate<T> extends true ? never : T;

const auth = <T extends readonly (UserRoleEnum | 'ANY' | 'OPTIONAL' | 'CHECK_SUBSCRIPTION' )[]>(
  ...roles: NoDuplicates<T> extends never ? never : T
) => {
  const doesCheckSubscription = roles.includes('CHECK_SUBSCRIPTION');
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization;
      if (!token) {
        if (roles.includes('OPTIONAL')) {
          next();
          return;
        }
        throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
      }

      const verifyUserToken = verifyToken(
        token,
        config.jwt.access_secret as Secret,
      );

      // Check user is exist
      const user = await insecurePrisma.user.findUniqueOrThrow({
        where: {
          id: verifyUserToken.id,
        },
        include: {
          ...(doesCheckSubscription && {
            payments: {
              where: {
                paymentType: 'SUBSCRIPTION',
                paymentStatus: 'SUCCESS'
              },
              select: {
                id: true,
                paymentStatus: true,
                subscriptionPackageId: true,
                endAt: true
              }
            }
          })
        },
      });

      if (!user) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
      }
      if (user.isDeleted) {
        throw new AppError(httpStatus.NOT_FOUND, 'Account has been deleted. Please contact support to reactivate your account');
      }
      if (!user.isEmailVerified) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'You are not verified!');
      }



      if (user.status === 'BLOCKED') {
        throw new AppError(httpStatus.UNAUTHORIZED, 'You are Blocked!');
      }
      const payments = user.payments;
      if (doesCheckSubscription && !roles.includes('SUPERADMIN')) {
        const isVerified = new Date(payments?.filter((item: { paymentStatus: string; }) => item.paymentStatus === 'SUCCESS')[0]?.endAt || '') >= new Date();
        if (!isVerified) {
          throw new AppError(
            httpStatus.FORBIDDEN,
            'Your subscription has expired or is not active. Please subscribe to continue accessing this feature.'
          );
        }
      }

      if (user?.profilePhoto) {
        verifyUserToken.profilePhoto = user?.profilePhoto
      }

      req.user = verifyUserToken;
      if (roles.includes('ANY')) {
        next();
      } else {
        if (roles.length && !roles.includes(verifyUserToken.role)) {
          throw new AppError(httpStatus.FORBIDDEN, 'Forbidden!');
        }
        next()
      }

    } catch (error) {
      next(error);
    }
  };
};

export default auth;
