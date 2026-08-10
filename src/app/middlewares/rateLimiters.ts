import rateLimit, {
  type Options,
  type RateLimitRequestHandler,
} from 'express-rate-limit';
import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { getClientIpFromRequest } from '../utils/getClientIp';

const ipKey = (req: Request): string =>
  getClientIpFromRequest(req) || req.ip || 'unknown';

const guestKey = (req: Request): string => {
  const guestId = req.guest?.id;
  if (guestId) return `guest:${guestId}`;
  return `ip:${ipKey(req)}`;
};

const rateLimitHandler: Options['handler'] = (
  _req: Request,
  res: Response,
  _next,
  options,
) => {
  res.status(options.statusCode).json({
    success: false,
    message: options.message,
    errorDetails: { code: 'RATE_LIMIT' },
    statusCode: options.statusCode,
  });
};

type LimiterOpts = {
  windowMs: number;
  max: number;
  message: string;
  keyGenerator: (req: Request) => string;
  skipFailedRequests?: boolean;
};

const createLimiter = (opts: LimiterOpts): RateLimitRequestHandler =>
  rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: true,
    statusCode: httpStatus.TOO_MANY_REQUESTS,
    message: opts.message,
    keyGenerator: opts.keyGenerator,
    handler: rateLimitHandler,
    // Validate is off for custom key generators that use req.ip helpers
    validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  });

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Soft ceiling for all /api/v1 traffic */
export const globalApiLimiter = createLimiter({
  windowMs: MIN,
  max: 800,
  message: 'Too many requests. Please try again in a minute.',
  keyGenerator: ipKey,
});

export const guestBootstrapLimiter = createLimiter({
  windowMs: MIN,
  max: 60,
  message: 'Too many bootstrap requests. Please wait a moment.',
  keyGenerator: ipKey,
});

export const guestRefreshLimiter = createLimiter({
  windowMs: MIN,
  max: 30,
  message: 'Too many token refresh requests. Please wait a moment.',
  keyGenerator: ipKey,
});

export const guestMeGetLimiter = createLimiter({
  windowMs: MIN,
  max: 60,
  message: 'Too many profile requests. Please try again shortly.',
  keyGenerator: guestKey,
});

export const guestProfilePatchLimiter = createLimiter({
  windowMs: HOUR,
  max: 20,
  message: 'Too many profile updates. Please try again later.',
  keyGenerator: guestKey,
});

export const guestProfileImageLimiter = createLimiter({
  windowMs: HOUR,
  max: 10,
  message: 'Too many profile image uploads. Please try again later.',
  keyGenerator: guestKey,
});

export const roomCreateLimiter = createLimiter({
  windowMs: HOUR,
  max: 20,
  message:
    'Room create limit reached (20 per hour). Please try again later.',
  keyGenerator: guestKey,
});

export const roomListLimiter = createLimiter({
  windowMs: MIN,
  max: 60,
  message: 'Too many room list requests. Please try again shortly.',
  keyGenerator: guestKey,
});

export const roomByIdGetLimiter = createLimiter({
  windowMs: MIN,
  max: 60,
  message: 'Too many room fetch requests. Please try again shortly.',
  keyGenerator: req => {
    if (req.guest?.id) return `guest:${req.guest.id}`;
    return `ip:${ipKey(req)}`;
  },
});

export const roomMembersLimiter = createLimiter({
  windowMs: MIN,
  max: 30,
  message: 'Too many member list requests. Please try again shortly.',
  keyGenerator: guestKey,
});

export const roomUpdateLimiter = createLimiter({
  windowMs: HOUR,
  max: 20,
  message: 'Too many room updates. Please try again later.',
  keyGenerator: guestKey,
});

export const roomImageLimiter = createLimiter({
  windowMs: HOUR,
  max: 10,
  message: 'Too many room image uploads. Please try again later.',
  keyGenerator: guestKey,
});

export const roomArchiveLimiter = createLimiter({
  windowMs: HOUR,
  max: 30,
  message: 'Too many archive actions. Please try again later.',
  keyGenerator: guestKey,
});

export const roomDeleteLimiter = createLimiter({
  windowMs: HOUR,
  max: 20,
  message: 'Too many delete actions. Please try again later.',
  keyGenerator: guestKey,
});

export const joinedRoomsListLimiter = createLimiter({
  windowMs: MIN,
  max: 60,
  message: 'Too many joined-room requests. Please try again shortly.',
  keyGenerator: guestKey,
});

export const joinedRoomArchiveLimiter = createLimiter({
  windowMs: HOUR,
  max: 30,
  message: 'Too many archive actions. Please try again later.',
  keyGenerator: guestKey,
});

export const joinedRoomDeleteLimiter = createLimiter({
  windowMs: HOUR,
  max: 20,
  message: 'Too many delete actions. Please try again later.',
  keyGenerator: guestKey,
});

export const messagesListLimiter = createLimiter({
  windowMs: MIN,
  max: 60,
  message: 'Too many message list requests. Please try again shortly.',
  keyGenerator: guestKey,
});

export const activityLogsLimiter = createLimiter({
  windowMs: MIN,
  max: 30,
  message: 'Too many activity log requests. Please try again shortly.',
  keyGenerator: guestKey,
});
