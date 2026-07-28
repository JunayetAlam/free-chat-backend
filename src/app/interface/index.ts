import { Guest } from '@prisma/client';
import { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user: JwtPayload & {
        id?: string;
        role?: string;
        guestId?: string;
        profilePhoto?: string;
      };
      guest?: Guest;
    }
  }
}

export {};
