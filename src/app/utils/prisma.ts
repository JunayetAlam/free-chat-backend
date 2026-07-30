import { PrismaClient } from '@prisma/client';
import config from '../../config';

const createPrismaClient = (omitUserSecrets: boolean) =>
  new PrismaClient({
    datasources: {
      db: {
        url: config.database_url,
      },
    },
    log:
      config.env === 'development'
        ? ['error', 'warn']
        : ['error'],
    ...(omitUserSecrets
      ? {
          omit: {
            user: {
              password: true,
              otp: true,
              otpExpiry: true,
              isEmailVerified: true,
              emailVerificationToken: true,
              emailVerificationTokenExpires: true,
              isAgreeWithTerms: true,
            },
          },
        }
      : {}),
  });

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
  insecurePrisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient(true);

export const insecurePrisma =
  globalForPrisma.insecurePrisma ?? createPrismaClient(false);

if (config.env !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.insecurePrisma = insecurePrisma;
}
