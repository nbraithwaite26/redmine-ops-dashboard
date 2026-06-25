import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { readPortableConfig } from './portableConfig.js';

const here = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(here, '..', '..', '.env.local'), quiet: true });

const schema = z.object({
  // Required in centralized (web-server) mode. Optional when PORTABLE=true
  // — in portable mode these come from %APPDATA%\redmine-ops-dashboard\
  // config.json after the user logs in on first launch.
  REDMINE_BASE_URL: z.string().url().optional(),
  REDMINE_API_KEY: z.string().min(1).optional(),
  REDMINE_READ_ONLY: z.enum(['true', 'false']).default('true'),
  // CR #30 — portable per-user .exe distribution. When 'true', the server
  // reads its Redmine credentials from a per-user config file and skips
  // the admin/session/audit middleware (single-user model).
  PORTABLE: z.enum(['true', 'false']).default('false'),
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

  // Server cache (cache.ts) sizing. The default rejects any single response
  // larger than 1 MB so a runaway upstream can't OOM the process; raise it
  // for instances with large scoped gantt / issues payloads that get
  // silently rejected (visible via `getCacheStats().rejectedTooLarge`).
  CACHE_MAX_BYTES_PER_ENTRY: z.coerce
    .number()
    .int()
    .positive()
    .default(1_000_000),
  CACHE_MAX_ENTRIES: z.coerce.number().int().positive().default(500),

  // Upstream Redmine call timeout (per request). Default 15s matches
  // long-standing behavior. Raise on instances where writes (POST/PUT)
  // contend with paginated reads under load and 504 against the proxy.
  REDMINE_CLIENT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15_000),
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

const portable = env.PORTABLE === 'true';

// In centralized mode, Redmine creds are required at startup. In portable
// mode they may be absent on first launch — the user logs in via the
// portable auth route and credentials are persisted to disk from there.
if (!portable && (!env.REDMINE_BASE_URL || !env.REDMINE_API_KEY)) {
  console.error(
    '[config] REDMINE_BASE_URL and REDMINE_API_KEY are required when PORTABLE is not set.',
  );
  process.exit(1);
}

const adminEnabled = Boolean(
  env.ADMIN_USER && env.ADMIN_PASSWORD_HASH && env.SESSION_SECRET,
);

export const config = {
  // Static fallbacks. In portable mode these stay '' until the first
  // successful login; consumers call `getRedmineCredentials()` instead.
  redmineBaseUrl: (env.REDMINE_BASE_URL ?? '').replace(/\/$/, ''),
  redmineApiKey: env.REDMINE_API_KEY ?? '',
  portable,
  readOnly: env.REDMINE_READ_ONLY === 'true',
  port: env.PORT,
  // Comma-separated origins → array. Lets the backend accept both
  // http://localhost:5173 and the host machine's LAN URL during dev so
  // a teammate on the same network can hit Vite via http://<lan-ip>:5173.
  allowedOrigin: env.ALLOWED_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean),
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
    maxBytesPerEntry: env.CACHE_MAX_BYTES_PER_ENTRY,
    maxEntries: env.CACHE_MAX_ENTRIES,
  },
  redmine: {
    timeoutMs: env.REDMINE_CLIENT_TIMEOUT_MS,
  },
} as const;

export type AppConfig = typeof config;

/**
 * Resolve the active Redmine credentials. In centralized mode this is
 * the static env-driven pair; in portable mode it falls back to the
 * per-user config file populated by /api/portable/login. Throws when
 * portable mode hasn't been logged into yet — callers (proxy routes)
 * should let that bubble up so the UI shows the login screen.
 */
export interface RedmineCredentials {
  baseUrl: string;
  apiKey: string;
}

export class PortableNotConfiguredError extends Error {
  constructor() {
    super('Portable mode: log in to set your Redmine URL and API key.');
    this.name = 'PortableNotConfiguredError';
  }
}

export function getRedmineCredentials(): RedmineCredentials {
  if (!config.portable) {
    return { baseUrl: config.redmineBaseUrl, apiKey: config.redmineApiKey };
  }
  const cfg = readPortableConfig();
  if (!cfg) throw new PortableNotConfiguredError();
  return { baseUrl: cfg.redmineBaseUrl, apiKey: cfg.redmineApiKey };
}
