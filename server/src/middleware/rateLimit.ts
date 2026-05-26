import type { MiddlewareHandler } from 'hono';

/**
 * Process-local token bucket. Acceptable for a single-process Node deploy.
 * Plan §6 Notes: swap for a Redis-backed RateLimitStore for multi-replica
 * deployments.
 */
interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();

const RATE_PER_SECOND = 20;
const BURST = 40;

function refill(bucket: Bucket, now: number) {
  const elapsedSeconds = (now - bucket.updatedAt) / 1000;
  bucket.tokens = Math.min(BURST, bucket.tokens + elapsedSeconds * RATE_PER_SECOND);
  bucket.updatedAt = now;
}

export const rateLimit = (): MiddlewareHandler => async (c, next) => {
  const key =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    'local';
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: BURST, updatedAt: now };
    buckets.set(key, bucket);
  } else {
    refill(bucket, now);
  }
  if (bucket.tokens < 1) {
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
  bucket.tokens -= 1;
  await next();
};
