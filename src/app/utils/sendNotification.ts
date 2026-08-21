import httpStatus from 'http-status';
import { Message } from 'firebase-admin/messaging';
import AppError from '../errors/AppError';
import { firebaseMessaging } from '../lib/firebase';
import { prisma } from './prisma';

const UNRECOVERABLE_FCM_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/sender-id-mismatch',
  'messaging/installation-id-not-registered',
]);

const isLegacyFcmRegistrationToken = (value: string) => value.includes(':');

const targetForDeviceId = (
  deviceId: string,
): { fid: string } | { token: string } =>
  isLegacyFcmRegistrationToken(deviceId)
    ? { token: deviceId }
    : { fid: deviceId };

interface SendNotificationParams {
  token: string;
  title: string;
  body: string;
  link?: string;
  data?: Record<string, string>;
  guestId?: string;
}

const firebaseErrorMessage = (error: unknown) => {
  if (error && typeof error === 'object') {
    const withCode = error as { code?: string; message?: string };
    if (withCode.message) return withCode.message;
    if (withCode.code) return withCode.code;
  }
  if (error instanceof Error) return error.message;
  return 'Failed to send push notification';
};

const getFcmErrorCode = (error: unknown): string | undefined => {
  console.log('🔥 FCM error: getFcmErrorCode', error);
  if (!error || typeof error !== 'object') return undefined;
  const withCode = error as {
    code?: string;
    errorInfo?: { code?: string };
  };
  if (typeof withCode.errorInfo?.code === 'string')
    return withCode.errorInfo.code;
  if (typeof withCode.code === 'string') return withCode.code;
  return undefined;
};

const isUnrecoverableFcmTokenError = (error: unknown): boolean => {
  const code = getFcmErrorCode(error);
  return Boolean(code && UNRECOVERABLE_FCM_TOKEN_CODES.has(code));
};

const clearInvalidGuestFcmToken = async (guestId: string, token: string) => {
  await prisma.guestFcmToken.deleteMany({
    where: { guestId, token },
  });
};

export const isFcmTokenValid = async (token: string): Promise<boolean> => {
  const trimmed = token.trim();
  if (!trimmed) return false;

  try {
    await firebaseMessaging.send(
      { ...targetForDeviceId(trimmed), data: { ping: '1' } },
      true,
    );
    return true;
  } catch {
    return false;
  }
};

export const canDeliverPush = async (guest: {
  notificationsEnabled: boolean;
  isDeleted: boolean;
  fcmTokens?: { token: string }[];
}): Promise<boolean> => {
  if (!guest.notificationsEnabled || guest.isDeleted) {
    return false;
  }
  const tokens = (guest.fcmTokens ?? [])
    .map(row => row.token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return false;
  const validity = await Promise.all(tokens.map(isFcmTokenValid));
  return validity.some(Boolean);
};

const buildPushMessage = ({
  token,
  title,
  body,
  link,
  data,
}: SendNotificationParams): Message => {
  const payloadData: Record<string, string> = { ...data };
  if (link) payloadData.url = link;

  return {
    ...targetForDeviceId(token),
    notification: {
      title,
      body,
    },
    ...(Object.keys(payloadData).length > 0 ? { data: payloadData } : {}),
    webpush: {
      fcmOptions: {
        link,
      },
    },
  };
};

export const sendPushNotification = async (params: SendNotificationParams) => {
  try {
    return await firebaseMessaging.send(buildPushMessage(params));
  } catch (error) {
    throw new AppError(httpStatus.BAD_GATEWAY, firebaseErrorMessage(error), {
      code:
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: string }).code ?? '')
          : undefined,
    });
  }
};

export const sendPushNotificationSilent = async (
  params: SendNotificationParams,
): Promise<void> => {
  try {
    const messageId = await firebaseMessaging.send(buildPushMessage(params));
    console.log('🔥 Push success:', {
      messageId,
      title: params.title,
      body: params.body,
      link: params.link,
      data: params.data,
    });
  } catch (error) {
    const tokenInvalid = isUnrecoverableFcmTokenError(error);
    if (tokenInvalid && params.guestId) {
      try {
        await clearInvalidGuestFcmToken(params.guestId, params.token);
      } catch (clearError) {
        console.log('🔥 Failed to clear invalid FCM token:', clearError);
      }
    }

    console.log('🔥 Push error:', {
      title: params.title,
      body: params.body,
      link: params.link,
      data: params.data,
      guestId: params.guestId,
      token: params.token,
      message: firebaseErrorMessage(error),
      code: getFcmErrorCode(error),
      tokenCleared: tokenInvalid && Boolean(params.guestId),
      error,
    });
  }
};
