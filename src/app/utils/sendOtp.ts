import httpStatus from 'http-status';
import AppError from '../errors/AppError';
import config from '../../config';
import { prisma } from './prisma';
import { sendEmail } from './sendMail';
// import { parsePhoneNumberFromString } from 'libphonenumber-js';
// import Twilio from 'twilio';

// const client = Twilio(config.twilio.sid, config.twilio.auth_token);

// -----------------------------
// 1. SEND OTP VIA EMAIL
// -----------------------------
const sendOtpViaMail = async ({
    email,
    otp,
}: {
    email: string;
    otp: string;
}) => {
    try {
        await sendEmail(email, otp, 'Verification OTP');
        return { success: true, message: 'OTP sent via email' };
    } catch (err) {
        throw new AppError(
            httpStatus.INTERNAL_SERVER_ERROR,
            'Failed to send OTP email'
        );
    }
};

// -----------------------------
// 2. SEND OTP VIA PHONE NUMBER
// -----------------------------
// export const sendOtpViaNumber = async ({
//     phone,
//     otp,
// }: {
//     phone: string;
//     otp: string;
// }) => {
//     // Validate phone number
//     const phoneNumber = parsePhoneNumberFromString(phone);

//     if (!phoneNumber || !phoneNumber.isValid()) {
//         throw new AppError(
//             httpStatus.BAD_REQUEST,
//             'Invalid phone number format.'
//         );
//     }

//     const formattedPhone = phoneNumber.number; // E.164 format

//     try {
//         const message = await client.messages.create({
//             body: `Your verification OTP is: ${otp}`,
//             from: '+16578372327',
//             messagingServiceSid: config.twilio.messagingServiceSid,
//             to: formattedPhone,
//         });

//         return { success: true, message: 'OTP sent via phone', data: message };
//     } catch (err) {
//         throw new AppError(
//             httpStatus.INTERNAL_SERVER_ERROR,
//             'Failed to send OTP via phone'
//         );
//     }
// };

export const sendOtp = sendOtpViaMail
