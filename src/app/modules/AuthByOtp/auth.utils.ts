import { User } from "@prisma/client";
import { insecurePrisma, prisma } from "../../utils/prisma";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import { generateToken } from "../../utils/generateToken";
import { Secret, SignOptions } from "jsonwebtoken";
import config from "../../../config";
import { generateOTP, otpExpiryTime } from "../../utils/otp";
import { sendOtp } from "../../utils/sendOtp";

export const generateRefreshToken = async (email: string, user?: User) => {
    let userData: User;
    if (user) {
        userData = user
    } else {
        userData = await insecurePrisma.user.findUniqueOrThrow({
            where: {
                email: email,
            },
        });
    }

    if (userData.isDeleted) {
        throw new AppError(httpStatus.NOT_FOUND, 'Account has been deleted. Please contact support to reactivate your account');
    }

    if (userData.status === 'BLOCKED') {
        throw new AppError(httpStatus.FORBIDDEN, 'Account has been blocked');
    }

    if (userData.role === 'SUPERADMIN') {
        const accessToken = await generateToken(
            {
                id: userData.id,
                name: userData.firstName + userData.lastName,
                email: userData.email,
                role: userData.role,
                // isPaid: true
            },
            config.jwt.access_secret as Secret,
            config.jwt.access_expires_in as SignOptions['expiresIn'],
        );
        return {
            id: userData.id,
            role: userData.role,
            accessToken: accessToken,
            isPaid: true
        };
    }
    // const payments = await prisma.payment.count({
    //   where: {
    //     subscriptionPackage: {
    //       userType: {
    //         has: userData.role
    //       }
    //     },
    //     paymentType: 'SUBSCRIPTION',
    //     paymentStatus: 'SUCCESS',
    //     endAt: {
    //       gte: new Date()
    //     },
    //     userId: userData.id
    //   }
    // });
    const accessToken = await generateToken(
        {
            id: userData.id,
            name: userData.firstName + userData.lastName,
            email: userData.email,
            role: userData.role,
            // isPaid: payments > 0 ? true : false
        },
        config.jwt.access_secret as Secret,
        config.jwt.access_expires_in as SignOptions['expiresIn'],
    );
    return {
        id: userData.id,
        role: userData.role,
        accessToken: accessToken,
        // isPaid: payments > 0 ? true : false
    };
}

export const resendOtpUtil = async (email: string) => {
    const user = await insecurePrisma.user.findFirstOrThrow({
        where: {
            email: email,
        },
    });

    if (user.isDeleted) {
        throw new AppError(httpStatus.NOT_FOUND, 'Account has been deleted. Please contact support to reactivate your account');
    }

    if (user.status === 'BLOCKED') {
        throw new AppError(httpStatus.FORBIDDEN, 'User is blocked');
    }
    if (user.isEmailVerified) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Already verified')
    }

    // if (user.otp && user.otpExpiry && new Date(user.otpExpiry).getTime() > Date.now()) {
    //   const message = getOtpStatusMessage(user.otpExpiry);
    //   throw new AppError(httpStatus.CONFLICT, message)
    // }


    const otp = generateOTP();

    const updatedUser = await prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
            where: { email: email },
            data: {
                otp,
                otpExpiry: otpExpiryTime(),
                otpFor: 'USER_VERIFICATION',
            },
        });

        sendOtp({ email: user.email, otp });

        return {
            otp,
            message: 'Verify Otp has sent to your email'
        };
    });


    return { message: 'Verification otp sent successfully. Please check your email.', otp, };
};