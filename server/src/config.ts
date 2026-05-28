import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const here = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(here, '..', '..', '.env.local'), quiet: true });

const schema = z.object({
  REDMINE_BASE_URL: z.string().url(),
  REDMINE_API_KEY: z.string().min(1),
  REDMINE_READ_ONLY: z.enum(['true', 'false']).default('true'),
  PORT: z.coerce.number().int().positive().default(8787),
  ALLOWED_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  // Admin & Audit (plan §14) — all optional. If any is missing, admin is
  // disabled and the /api/auth + /api/admin routes return 501.
  ADMIN_USER: z.string().min(1).optional(),
  ADMIN_PASSWORD_HASH: z.string().min(20).optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  HISTORY_DB: z.string().default('./server/data/history.jsonl'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  // Optional. When set, the session + rate-limit stores switch from
  // process-local maps to Redis so they survive restarts and shard across
  // backend instances. Plan §13.
  REDIS_URL: z.string().url().optional(),

  // Cache warmer (CR #29). The warmer pre-fetches hot keys on boot and on
  // an interval; disable for tests / dev where you don't want background
  // upstream traffic.
  CACHE_WARM_ENABLED: z.enum(['true', 'false']).default('true'),
  CACHE_WARM_INTERVAL_MS: z.coerce.number().int().positive().default(5 * 60_000),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('[config] missing or invalid env vars:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

const adminEnabled = Boolean(
  env.ADMIN_USER && env.ADMIN_PASSWORD_HASH && env.SESSION_SECRET,
);

export const config = {
  redmineBaseUrl: env.REDMINE_BASE_URL.replace(/\/$/, ''),
  redmineApiKey: env.REDMINE_API_KEY,
  readOnly: env.REDMINE_READ_ONLY === 'true',
  port: env.PORT,
  allowedOrigin: env.ALLOWED_ORIGIN,
  logLevel: env.LOG_LEVEL,
  admin: {
    enabled: adminEnabled,
    user: env.ADMIN_USER ?? '',
    passwordHash: env.ADMIN_PASSWORD_HASH ?? '',
    sessionSecret: env.SESSION_SECRET ?? '',
    historyDb: env.HISTORY_DB,
    cookieSecure: env.COOKIE_SECURE === 'true',
  },
  redisUrl: env.REDIS_URL,
  cache: {
    warmEnabled: env.CACHE_WARM_ENABLED === 'true',
    warmIntervalMs: env.CACHE_WARM_INTERVAL_MS,
  },
} as const;

export type AppConfig = typeof config;
