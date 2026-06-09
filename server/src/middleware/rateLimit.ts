import type { MiddlewareHandler } from 'hono';
import { getRedis } from '../store/redisClient.js';

/**
 * Rate-limit IP traffic to /api/*. Two backends:
 *
 *  - Redis (when REDIS_URL is set): atomic INCR rl:<ip>:<sec> per 1s window
 *    with EXPIRE; survives restarts and shards across backend instances.
 *  - In-memory (fallback): process-local token bucket. Acceptable for a
 *    single-process Node deploy. Plan §13.
 */
interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();

// Bumped from 20/40 once frontend list endpoints started paginating
// internally — a single Dashboard load now fires ~38 sequential page
// requests for /issues alone. 100/sec sustained / 200 burst leaves
// comfortable headroom for the browser while still rejecting actual
// abuse from a misconfigured client.
const RATE_PER_SECOND = 100;
const BURST = 200;
const WINDOW_SECONDS = 1;
const INTERNAL_HEADER = 'x-internal-warmer';
// Redis branch uses fixed-window-per-second, so limit = burst keeps the
// effective ceiling consistent with the in-memory token bucket.
const REDIS_LIMIT_PER_WINDOW = BURST;

function refill(bucket: Bucket, now: number) {
  const elapsedSeconds = (now - bucket.updatedAt) / 1000;
  bucket.tokens = Math.min(BURST, bucket.tokens + elapsedSeconds * RATE_PER_SECOND);
  bucket.updatedAt = now;
}

function clientKey(c: import('hono').Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    'local'
  );
}

function rejected(c: import('hono').Context) {
  return c.json(
    {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests; slow down.',
        requestId: c.get('requestId'),
      },
    },
    429,
  );
}

export const rateLimit = (): MiddlewareHandler => async (c, next) => {
  // Internal warmer requests bypass the rate limiter — they share the
  // 'local' IP key with the browser and would otherwise cannibalize the
  // user's quota during a paginated walk.
  if (c.req.header(INTERNAL_HEADER)) {
    await next();
    return;
  }

  const key = clientKey(c);
  const redis = await getRedis();

  if (redis) {
    const windowSec = Math.floor(Date.now() / 1000);
    const redisKey = `rl:${key}:${windowSec}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, WINDOW_SECONDS + 1);
    }
    if (count > REDIS_LIMIT_PER_WINDOW) {
      return rejected(c);
    }
    await next();
    return;
  }

  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: BURST, updatedAt: now };
    buckets.set(key, bucket);
  } else {
    refill(bucket, now);
  }
  if (bucket.tokens < 1) {
    return rejected(c);
  }
  bucket.tokens -= 1;
  await next();
};

/** Test-only. */
export function __clearMemBuckets() {
  buckets.clear();
}
