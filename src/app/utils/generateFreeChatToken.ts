import jwt, { Secret, SignOptions } from 'jsonwebtoken';

export const generateFreeChatToken = (
  payload: { deviceUniqueCode: string; deviceFingerprint: string },
  secret: Secret,
  expiresIn: SignOptions['expiresIn'],
) => {
  const token = jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn,
  });
  return token;
};
