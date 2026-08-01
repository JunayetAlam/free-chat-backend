type Bucket = {
  /** Timestamps of events within the window */
  hits: number[];
  /** Last accepted timestamp (for min-interval / burst) */
  lastAt: number;
};

const buckets = new Map<string, Bucket>();

export type WsRateLimitCode = 'RATE_LIMIT_BURST' | 'RATE_LIMIT_WINDOW';

export type WsRateLimitResult = {
  code: WsRateLimitCode;
  message: string;
  retryAfterMs: number;
};

const getBucket = (key: string): Bucket => {
  let b = buckets.get(key);
  if (!b) {
    b = { hits: [], lastAt: 0 };
    buckets.set(key, b);
  }
  return b;
};

const prune = (b: Bucket, windowMs: number, now: number) => {
  const cutoff = now - windowMs;
  b.hits = b.hits.filter(t => t > cutoff);
};

/**
 * Returns null if allowed, or structured rate-limit info if limited.
 */
export const checkWindowLimit = (
  key: string,
  max: number,
  windowMs: number,
  now = Date.now(),
): WsRateLimitResult | null => {
  const b = getBucket(key);
  prune(b, windowMs, now);
  if (b.hits.length >= max) {
    const oldest = b.hits[0] ?? now;
    const retryAfterMs = Math.max(1000, windowMs - (now - oldest));
    return {
      code: 'RATE_LIMIT_WINDOW',
      message: 'Too many requests. Please try again in a moment.',
      retryAfterMs,
    };
  }
  b.hits.push(now);
  return null;
};

/**
 * Enforces a minimum gap between accepts. Returns structured limit or null.
 * Does not count toward window buckets by itself.
 */
export const checkMinInterval = (
  key: string,
  minIntervalMs: number,
  now = Date.now(),
): WsRateLimitResult | null => {
  const b = getBucket(key);
  if (b.lastAt > 0 && now - b.lastAt < minIntervalMs) {
    const retryAfterMs = minIntervalMs - (now - b.lastAt);
    return {
      code: 'RATE_LIMIT_BURST',
      message: "You're sending messages too quickly.",
      retryAfterMs,
    };
  }
  b.lastAt = now;
  return null;
};

const MIN = 60_000;

export const WS_LIMITS = {
  connectionPerIp: { max: 100, windowMs: MIN },
  allEventsPerGuest: { max: 120, windowMs: MIN },
  messageSendPerMin: { max: 30, windowMs: MIN },
  messageSendBurstMs: 400,
  messageEdit: { max: 20, windowMs: MIN },
  messageDelete: { max: 20, windowMs: MIN },
  roomJoin: { max: 20, windowMs: MIN },
  historyMore: { max: 30, windowMs: MIN },
  conversationList: { max: 20, windowMs: MIN },
} as const;

export const checkWsConnectionLimit = (ip: string): WsRateLimitResult | null =>
  checkWindowLimit(
    `ws:conn:${ip || 'unknown'}`,
    WS_LIMITS.connectionPerIp.max,
    WS_LIMITS.connectionPerIp.windowMs,
  );

export const checkWsAllEventsLimit = (
  guestId: string,
): WsRateLimitResult | null =>
  checkWindowLimit(
    `ws:all:${guestId}`,
    WS_LIMITS.allEventsPerGuest.max,
    WS_LIMITS.allEventsPerGuest.windowMs,
  );

export const checkWsEventLimit = (
  guestId: string,
  event: string,
): WsRateLimitResult | null => {
  switch (event) {
    case 'MESSAGE_SEND': {
      const burst = checkMinInterval(
        `ws:msgburst:${guestId}`,
        WS_LIMITS.messageSendBurstMs,
      );
      if (burst) return burst;
      return checkWindowLimit(
        `ws:msgsend:${guestId}`,
        WS_LIMITS.messageSendPerMin.max,
        WS_LIMITS.messageSendPerMin.windowMs,
      );
    }
    case 'MESSAGE_EDIT':
      return checkWindowLimit(
        `ws:msgedit:${guestId}`,
        WS_LIMITS.messageEdit.max,
        WS_LIMITS.messageEdit.windowMs,
      );
    case 'MESSAGE_DELETE':
      return checkWindowLimit(
        `ws:msgdel:${guestId}`,
        WS_LIMITS.messageDelete.max,
        WS_LIMITS.messageDelete.windowMs,
      );
    case 'ROOM_JOIN':
      return checkWindowLimit(
        `ws:join:${guestId}`,
        WS_LIMITS.roomJoin.max,
        WS_LIMITS.roomJoin.windowMs,
      );
    case 'MESSAGE_HISTORY_MORE':
      return checkWindowLimit(
        `ws:hist:${guestId}`,
        WS_LIMITS.historyMore.max,
        WS_LIMITS.historyMore.windowMs,
      );
    case 'CONVERSATION_LIST':
      return checkWindowLimit(
        `ws:conv:${guestId}`,
        WS_LIMITS.conversationList.max,
        WS_LIMITS.conversationList.windowMs,
      );
    default:
      return null;
  }
};
