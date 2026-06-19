import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types/appVars.js';
import {
  clearPortableConfig,
  readPortableConfig,
  writePortableConfig,
} from '../portableConfig.js';
import {
  disableAutostart,
  enableAutostart,
  getAutostartStatus,
} from '../portableAutostart.js';

/**
 * CR #30 — portable auth.
 *
 * GET  /api/portable/status — { configured, redmineUrl?, login? }
 * POST /api/portable/login  — { redmineUrl, username, password }
 *                              → calls Redmine /users/current.json with
 *                                Basic Auth, persists api_key on disk.
 * POST /api/portable/logout — clear the persisted config.
 *
 * The user's password is held in memory only for the upstream call and
 * never written to disk. We persist the api_key returned by Redmine.
 *
 * Mounted in index.ts only when `config.portable === true` — in
 * centralized mode the route is absent.
 */

const portableAuth = new Hono<AppEnv>();

/**
 * Strip the trailing slash plus common Redmine UI suffixes a user might
 * paste from their browser address bar (e.g. `/login`, `/my/page`,
 * `/projects/...`). Done iteratively so `/projects/123/issues/45` peels
 * back to the install root. Preserves subpath installs like
 * `https://example.com/redmine` because those don't end in a known
 * Redmine UI path component.
 */
const UI_SUFFIX_RE = /\/(login|logout|my|account|admin|projects|issues|users|time_entries|easy_calendars|attachments)(\/[^?#]*)?$/i;

export function normalizeRedmineUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, '');
  // Peel up to a few times in case multiple known segments are tacked on.
  for (let i = 0; i < 4; i++) {
    const next = url.replace(UI_SUFFIX_RE, '');
    if (next === url) break;
    url = next.replace(/\/+$/, '');
  }
  return url;
}

const LOGIN_TIMEOUT_MS = 10_000;

// Two login shapes:
//   1. username + password — server uses Basic Auth to fetch /users/current.json,
//      which returns the api_key for standard Redmine instances.
//   2. apiKey only — used for Easy Redmine (no "Enable REST" toggle; key
//      is shown directly in the user's account page). Server validates
//      the key against /users/current.json via X-Redmine-API-Key header.
const loginSchema = z
  .object({
    redmineUrl: z.string().url(),
    username: z.string().min(1).max(256).optional(),
    password: z.string().min(1).max(1024).optional(),
    apiKey: z.string().min(1).max(256).optional(),
  })
  .refine(
    (v) =>
      Boolean(v.apiKey) ||
      (typeof v.username === 'string' && v.username.length > 0 &&
       typeof v.password === 'string' && v.password.length > 0),
    { message: 'Provide either apiKey, or username + password.' },
  );

// Simple in-memory throttle. Single-user model — one bucket suffices.
let loginAttempts = { count: 0, resetAt: 0 };
const ATTEMPT_WINDOW_MS = 60_000;
const ATTEMPT_MAX = 5;

function allowLoginAttempt(): boolean {
  const now = Date.now();
  if (now > loginAttempts.resetAt) {
    loginAttempts = { count: 1, resetAt: now + ATTEMPT_WINDOW_MS };
    return true;
  }
  if (loginAttempts.count >= ATTEMPT_MAX) return false;
  loginAttempts.count += 1;
  return true;
}

interface RedmineCurrentUserResponse {
  user: {
    id: number;
    login: string;
    firstname: string;
    lastname: string;
    api_key?: string;
  };
}

portableAuth.get('/status', (c) => {
  const cfg = readPortableConfig();
  if (!cfg) return c.json({ configured: false });
  return c.json({
    configured: true,
    redmineUrl: cfg.redmineBaseUrl,
    login: cfg.login,
    loggedInAt: cfg.loggedInAt,
  });
});

portableAuth.post('/login', async (c) => {
  const requestId = c.get('requestId');

  if (!allowLoginAttempt()) {
    return c.json(
      { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again in a minute.', requestId } },
      429,
    );
  }

  let parsed: z.infer<typeof loginSchema>;
  try {
    parsed = loginSchema.parse(await c.req.json());
  } catch (err) {
    return c.json(
      {
        error: {
          code: 'BAD_REQUEST',
          message:
            err instanceof z.ZodError
              ? err.issues[0]?.message ?? 'Invalid login body.'
              : 'Invalid login body.',
          requestId,
        },
      },
      400,
    );
  }

  // Normalize the URL: strip trailing slash AND common Redmine UI paths.
  // Users pasted in from the browser frequently end up with `/login` or
  // `/my/page` on the end. Stripping these covers the most common
  // mistakes while still respecting subpath installs (e.g.
  // `https://example.com/redmine/login` → `https://example.com/redmine`).
  const baseUrl = normalizeRedmineUrl(parsed.redmineUrl);

  // Two auth modes:
  //   - apiKey present → validate via X-Redmine-API-Key header (Easy
  //     Redmine path, where users see their key directly).
  //   - otherwise → Basic Auth with username + password.
  const usingApiKey = Boolean(parsed.apiKey);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (usingApiKey) {
    headers['X-Redmine-API-Key'] = parsed.apiKey as string;
  } else {
    headers['Authorization'] = `Basic ${Buffer.from(
      `${parsed.username}:${parsed.password}`,
    ).toString('base64')}`;
  }

  // Standard Redmine wants ?include=api_key so it returns the key in the
  // body. Easy Redmine (api_key path) doesn't need that — we already
  // have the key, just need to confirm it works and learn the login.
  const upstreamUrl = usingApiKey
    ? `${baseUrl}/users/current.json`
    : `${baseUrl}/users/current.json?include=api_key`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    return c.json(
      {
        error: {
          code: 'UPSTREAM_UNREACHABLE',
          message:
            err instanceof Error && err.name === 'AbortError'
              ? 'Redmine took too long to respond. Check the URL.'
              : 'Could not reach Redmine. Check the URL.',
          requestId,
        },
      },
      502,
    );
  } finally {
    clearTimeout(timer);
  }

  if (upstream.status === 401) {
    return c.json(
      {
        error: {
          code: 'INVALID_CREDENTIALS',
          message: usingApiKey
            ? 'API key rejected by Redmine. Double-check it and your URL.'
            : 'Username or password rejected by Redmine.',
          requestId,
        },
      },
      401,
    );
  }
  if (upstream.status === 404) {
    // 404 is almost always a URL-shape problem: Redmine lives under a
    // subpath (e.g. `/redmine`) that the user didn't include, OR the
    // host is correct but isn't actually Redmine. Surface the URL we
    // tried so they can spot it instantly.
    return c.json(
      {
        error: {
          code: 'UPSTREAM_NOT_FOUND',
          message:
            `Redmine returned 404 for ${baseUrl}/users/current.json. ` +
            `Double-check the URL — if Redmine lives under a subpath (e.g. ${baseUrl}/redmine), ` +
            `include that in the URL field.`,
          requestId,
        },
      },
      502,
    );
  }
  if (!upstream.ok) {
    return c.json(
      { error: { code: 'UPSTREAM_ERROR', message: `Redmine returned ${upstream.status} for ${baseUrl}/users/current.json.`, requestId } },
      502,
    );
  }

  let data: RedmineCurrentUserResponse;
  try {
    data = (await upstream.json()) as RedmineCurrentUserResponse;
  } catch {
    return c.json(
      { error: { code: 'UPSTREAM_ERROR', message: 'Redmine returned a malformed response.', requestId } },
      502,
    );
  }

  // Resolve which api_key to persist:
  //   - apiKey path → the key the user pasted (Redmine just confirmed it works).
  //   - password path → the key Redmine returned in the response body.
  // Standard Redmine includes api_key when REST is enabled; some instances
  // (Easy Redmine, hardened setups) omit it — in that case nudge the user
  // toward the api-key tab instead.
  const resolvedApiKey = usingApiKey ? (parsed.apiKey as string) : data.user?.api_key;
  if (!resolvedApiKey) {
    return c.json(
      {
        error: {
          code: 'NO_API_KEY',
          message:
            "Redmine didn't include an API key in the response. " +
            "Try the 'I have an API key' option instead and paste the key from your Redmine account page.",
          requestId,
        },
      },
      422,
    );
  }

  writePortableConfig({
    redmineBaseUrl: baseUrl,
    redmineApiKey: resolvedApiKey,
    login: data.user.login,
    loggedInAt: new Date().toISOString(),
  });

  return c.json({
    configured: true,
    redmineUrl: baseUrl,
    login: data.user.login,
    user: {
      id: data.user.id,
      login: data.user.login,
      name: `${data.user.firstname} ${data.user.lastname}`.trim(),
    },
  });
});

portableAuth.post('/logout', (c) => {
  clearPortableConfig();
  return c.json({ ok: true });
});

/**
 * Graceful shutdown for the portable .exe. Called by the SPA's Quit
 * button. Responds first so the browser sees a clean 200, then exits the
 * Node/Bun process on the next tick.
 */
portableAuth.post('/shutdown', (c) => {
  // Mark this as a clean, user-initiated exit so the runtime log is
  // easy to distinguish from a crash.
  console.log('[server] shutdown requested via /api/portable/shutdown');
  setTimeout(() => process.exit(0), 50);
  return c.json({ ok: true, shuttingDown: true });
});

/** Current autostart state — what the toggle should reflect. */
portableAuth.get('/autostart', (c) => {
  return c.json(getAutostartStatus());
});

/** Enable or disable Windows sign-in autostart for this .exe. */
portableAuth.put('/autostart', async (c) => {
  const requestId = c.get('requestId');
  let body: { enabled?: unknown };
  try {
    body = (await c.req.json()) as { enabled?: unknown };
  } catch {
    return c.json(
      { error: { code: 'BAD_REQUEST', message: 'Expected JSON body.', requestId } },
      400,
    );
  }
  if (typeof body.enabled !== 'boolean') {
    return c.json(
      { error: { code: 'BAD_REQUEST', message: '`enabled` must be a boolean.', requestId } },
      400,
    );
  }
  try {
    const next = body.enabled ? enableAutostart() : disableAutostart();
    return c.json(next);
  } catch (err) {
    return c.json(
      {
        error: {
          code: 'UPSTREAM_ERROR',
          message: err instanceof Error ? err.message : 'Failed to update autostart.',
          requestId,
        },
      },
      500,
    );
  }
});

export default portableAuth;
