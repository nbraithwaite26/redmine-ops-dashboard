import { Hono } from 'hono';
import { z } from 'zod';
import { config } from '../config.js';
import type { AppEnv } from '../types/appVars.js';
import { verifyPassword } from '../auth/password.js';
import {
  buildClearCookieHeader,
  buildSetCookieHeader,
  readCookieFromHeader,
  verifyCookieValue,
} from '../auth/cookies.js';
import {
  createSession,
  destroySession,
  maxAgeSeconds,
} from '../store/sessionStore.js';
import { appendEvent } from '../store/historyStore.js';

const auth = new Hono<AppEnv>();

const loginBucket = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

function rateLimitKey(c: import('hono').Context<AppEnv>): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    'local'
  );
}

function checkLoginRate(key: string): boolean {
  const now = Date.now();
  const entry = loginBucket.get(key);
  if (!entry || now > entry.resetAt) {
    loginBucket.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

const loginSchema = z.object({
  user: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

auth.get('/me', async (c) => {
  if (!config.admin.enabled) {
    return c.json({ error: { code: 'ADMIN_DISABLED' } }, 501);
  }
  const user = c.get('sessionUser') as string | undefined;
  if (!user) return c.json({ user: null });
  return c.json({ user });
});

auth.post('/login', async (c) => {
  if (!config.admin.enabled) {
    return c.json({ error: { code: 'ADMIN_DISABLED' } }, 501);
  }

  const ip = rateLimitKey(c);
  const requestId = c.get('requestId') as string;

  if (!checkLoginRate(ip)) {
    await appendEvent({
      kind: 'login',
      at: new Date().toISOString(),
      user: '',
      status: 'rate_limited',
      sourceIp: ip,
      requestId,
    });
    return c.json(
      {
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many attempts. Try again in a minute.',
          requestId,
        },
      },
      429,
    );
  }

  let body: { user: string; password: string };
  try {
    body = loginSchema.parse(await c.req.json());
  } catch {
    return c.json(
      {
        error: { code: 'BAD_REQUEST', message: 'Invalid login payload.', requestId },
      },
      400,
    );
  }

  const truncatedUser = body.user.slice(0, 64);
  const userMatches = body.user === config.admin.user;
  // Always compare against the configured hash even when user is wrong, so
  // failure timing does not leak whether the user exists.
  const passwordOk = await verifyPassword(body.password, config.admin.passwordHash);
  const ok = userMatches && passwordOk;

  await appendEvent({
    kind: 'login',
    at: new Date().toISOString(),
    user: truncatedUser,
    status: ok ? 'success' : 'failed',
    sourceIp: ip,
    requestId,
  });

  if (!ok) {
    // Single generic error so attackers cannot tell "no such user" from
    // "wrong password".
    return c.json(
      {
        error: {
          code: 'AUTH_FAILED',
          message: 'Invalid username or password.',
          requestId,
        },
      },
      401,
    );
  }

  const session = await createSession(truncatedUser);
  c.header('Set-Cookie', buildSetCookieHeader(session.id, maxAgeSeconds()));
  return c.json({ user: truncatedUser, loginAt: new Date(session.createdAt).toISOString() });
});

auth.post('/logout', async (c) => {
  if (!config.admin.enabled) {
    return c.json({ error: { code: 'ADMIN_DISABLED' } }, 501);
  }
  const cookieValue = readCookieFromHeader(c.req.header('cookie'));
  if (cookieValue) {
    const sessionId = verifyCookieValue(cookieValue);
    if (sessionId) await destroySession(sessionId);
  }
  c.header('Set-Cookie', buildClearCookieHeader());
  return c.json({ ok: true });
});

export default auth;
