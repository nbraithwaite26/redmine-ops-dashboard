import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';

async function makeApp() {
  const { Hono: H } = await import('hono');
  const { requestId } = await import('../src/middleware/requestId.js');
  const { session } = await import('../src/middleware/session.js');
  const { default: authRoute } = await import('../src/routes/auth.js');
  const app = new H();
  app.use('*', requestId());
  app.use('*', session());
  app.route('/auth', authRoute);
  return app as unknown as Hono;
}

// Anchored to repo root so the test reads the same file the historyStore
// writes (see server/src/store/historyStore.ts for the same pattern).
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HISTORY_PATH = resolve(REPO_ROOT, 'server/test/.tmp-history.jsonl');

async function clearHistory() {
  try {
    await fs.unlink(HISTORY_PATH);
  } catch {
    /* ignore */
  }
}

afterAll(async () => {
  await clearHistory();
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await clearHistory();
  });

  it('rejects wrong password with generic error', async () => {
    const app = await makeApp();
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: 'admin', password: 'wrong' }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('AUTH_FAILED');
    expect(body.error.message).toMatch(/invalid username or password/i);
  });

  it('rejects wrong user with the SAME generic error (no enumeration)', async () => {
    const app = await makeApp();
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: 'nobody', password: 'wrong' }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('AUTH_FAILED');
    expect(body.error.message).toMatch(/invalid username or password/i);
  });

  it('accepts the right password and sets an HttpOnly cookie', async () => {
    const app = await makeApp();
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: 'admin', password: 'secret-pw' }),
    });
    expect(res.status).toBe(200);
    const cookie = res.headers.get('Set-Cookie') ?? '';
    expect(cookie).toMatch(/^rod_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    const body = (await res.json()) as { user: string };
    expect(body.user).toBe('admin');
  });

  it('records login attempts in the history store', async () => {
    const app = await makeApp();
    await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: 'admin', password: 'wrong' }),
    });
    const raw = await fs.readFile(HISTORY_PATH, 'utf8');
    const events = raw
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { kind: string; status: string; user: string });
    expect(events.some((e) => e.kind === 'login' && e.status === 'failed')).toBe(true);
  });
});

describe('GET /auth/me', () => {
  it('returns { user: null } without a cookie', async () => {
    const app = await makeApp();
    const res = await app.request('/auth/me');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: string | null };
    expect(body.user).toBeNull();
  });

  it('returns the logged-in user when the cookie is present', async () => {
    const app = await makeApp();
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: 'admin', password: 'secret-pw' }),
    });
    const setCookie = loginRes.headers.get('Set-Cookie') ?? '';
    const cookiePair = setCookie.split(';')[0]!; // "rod_session=<value>"
    const meRes = await app.request('/auth/me', {
      headers: { cookie: cookiePair },
    });
    const body = (await meRes.json()) as { user: string | null };
    expect(body.user).toBe('admin');
  });
});

describe('POST /auth/logout', () => {
  it('clears the cookie', async () => {
    const app = await makeApp();
    const res = await app.request('/auth/logout', { method: 'POST' });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toMatch(/^rod_session=;/);
    expect(setCookie).toMatch(/Max-Age=0/);
  });
});
