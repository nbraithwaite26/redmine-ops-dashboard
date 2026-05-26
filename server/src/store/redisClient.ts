import type { Redis } from 'ioredis';
import { config } from '../config.js';

/**
 * Lazily-constructed Redis client. Returns null when REDIS_URL is unset so
 * callers fall back to their in-memory implementation. Connection failures
 * are logged but never throw — a Redis outage degrades the affected store
 * to in-memory rather than taking down the backend.
 *
 * Plan §13: enables multi-instance deploys + session survival across restart.
 */
let client: Redis | null = null;
let initialized = false;

export async function getRedis(): Promise<Redis | null> {
  if (initialized) return client;
  initialized = true;
  if (!config.redisUrl) return null;
  try {
    const { default: Redis } = await import('ioredis');
    client = new Redis(config.redisUrl, {
      lazyConnect: false,
      maxRetriesPerRequest: 2,
    });
    client.on('error', (err: Error) => {
      console.error('[redis] client error:', err.message);
    });
  } catch (err) {
    console.error('[redis] failed to initialize:', (err as Error).message);
    client = null;
  }
  return client;
}

export function hasRedis(): boolean {
  return Boolean(config.redisUrl);
}

/** Test-only. Resets the singleton so vi.resetModules() can re-init cleanly. */
export function __resetRedisForTests() {
  client = null;
  initialized = false;
}
