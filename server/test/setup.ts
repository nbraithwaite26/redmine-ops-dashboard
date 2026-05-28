/**
 * Shared test bootstrap. Sets the env vars config.ts needs so any module
 * that imports ../src/config doesn't exit the process.
 */
import { beforeEach } from 'vitest';
import { resetCache } from '../src/cache.js';

process.env.REDMINE_BASE_URL = 'https://example.invalid';
process.env.REDMINE_API_KEY = 'test-key';
process.env.REDMINE_READ_ONLY = 'true';
process.env.PORT = '8788';
process.env.ALLOWED_ORIGIN = 'http://localhost:5173';
process.env.LOG_LEVEL = 'error';
// Admin config — known bcrypt hash for plaintext "secret-pw"
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD_HASH =
  '$2b$12$CebPh2jM8Ks.L8qWgkYkUeOlbDHXYr.YG9eIIVBJDW4D4.xMYGmdi';
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-bytes-long';
process.env.HISTORY_DB = './server/test/.tmp-history.jsonl';
process.env.COOKIE_SECURE = 'false';

// The server-side cache (CR #29) is module-level singleton state. Clear it
// before every test so suites that exercise cached routes don't bleed into
// each other.
beforeEach(() => {
  resetCache();
});
