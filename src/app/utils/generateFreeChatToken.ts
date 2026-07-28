import jwt, { Secret, SignOptions } from 'jsonwebtoken';

export type GuestTokenPayload = {
  guestId: string;
};

export const generateFreeChatToken = (
  payload: GuestTokenPayload,
  secret: Secret,
  expiresIn: SignOptions['expiresIn'],
) => {
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn,
  });
};
