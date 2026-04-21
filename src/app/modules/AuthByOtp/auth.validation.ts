import { UserRoleEnum } from '@prisma/client';
import z from 'zod';

const loginUser = z.object({
  body: z.object({
    email: z.string({
      error: 'Email is required!',
    }),
    password: z.string({
      error: 'Password is required!',
    }),
  }).strict(),
});

const registerUser = z.object({
  body: z.object({
    firstName: z.string({
      error: 'First Name is required!',
    }),
    lastName: z.string({
      error: 'Last Name is required!',
    }),
    email: z
      .string({
        error: 'Email is required!',
      })
      .email({
        message: 'Invalid email format!',
      }),
    phoneNumber: z.string({
      error: 'Phone Number is required!',
    }),
    isAgreeWithTerms: z.boolean().refine(val => val === true, {
      message: "You must agree to the terms"
    }),
    password: z.string({
      error: 'Password is required!',
    }),
  }).strict(),
});

const verifyEmail = z.object({
  body: z.object({
    email: z.string({
      error: 'Email is required!',
    }),
    otp: z.string({
      error: 'OTP is required!',
    }),
  }).strict(),
});

const resendOtp = z.object({
  body: z.object({
    email: z.string({
      error: 'Email is required!',
    }),
  }).strict(),
});

const changePassword = z.object({
  body: z.object({
    oldPassword: z.string({
      error: 'Old password is required!',
    }),
    newPassword: z.string({
      error: 'New password is required!',
    }),
  }).strict(),
});

const forgetPassword = z.object({
  body: z.object({
    email: z.string({
      error: 'Email is required!',
    }),
  }).strict(),
});

const verifyForgotOtp = z.object({
  body: z.object({
    email: z.string({
      error: 'Email is required!',
    }),
    otp: z.string({
      error: 'OTP is required!',
    }),
  }).strict(),
});

const resetPassword = z.object({
  body: z.object({
    email: z.string({
      error: 'Email is required!',
    }),
    newPassword: z.string({
      error: 'New password is required!',
    }),
  }).strict(),
});

export const authValidation = {
  loginUser,
  registerUser,
  verifyEmail,
  resendOtp,
  changePassword,
  forgetPassword,
  verifyForgotOtp,
  resetPassword,
};
