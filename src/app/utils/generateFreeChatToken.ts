import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'crypto';

export type GuestTokenPayload = {
  guestId: string;
  /** Unique per mint so rotate always yields a new token string. Not stored in DB. */
  jti?: string;
};

export const generateFreeChatToken = (
  payload: GuestTokenPayload,
  secret: Secret,
  expiresIn: SignOptions['expiresIn'],
) => {
  return jwt.sign(
    {
      guestId: payload.guestId,
      jti: payload.jti || randomUUID(),
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn,
    },
  );
};
