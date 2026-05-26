import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../src/types/appVars.js';

async function makeGuardedApp() {
  const { Hono } = await import('hono');
  const { requestId } = await import('../src/middleware/requestId.js');
  const { session, requireSession } = await import('../src/middleware/session.js');
  const app = new Hono<AppEnv>();
  app.use('*', requestId());
  app.use('*', session());
  app.use('*', requireSession());
  app.get('/secret', (c) => c.json({ ok: true, user: c.get('sessionUser') }));
  return app;
}

describe('requireSession middleware', () => {
  it('401s without a cookie', async () => {
    const app = await makeGuardedApp();
    const res = await app.request('/secret');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a tampered cookie signature', async () => {
    const app = await makeGuardedApp();
    const res = await app.request('/secret', {
      headers: { cookie: 'rod_session=abc.tamperedsig' },
    });
    expect(res.status).toBe(401);
  });

  it('passes through a valid session', async () => {
    const { default: authRoute } = await import('../src/routes/auth.js');
    const { Hono } = await import('hono');
    const { requestId } = await import('../src/middleware/requestId.js');
    const { session } = await import('../src/middleware/session.js');
    const loginApp = new Hono();
    loginApp.use('*', requestId());
    loginApp.use('*', session());
    loginApp.route('/auth', authRoute);

    const loginRes = await loginApp.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: 'admin', password: 'secret-pw' }),
    });
    const cookie = (loginRes.headers.get('Set-Cookie') ?? '').split(';')[0]!;

    const guarded = await makeGuardedApp();
    const res = await guarded.request('/secret', { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; user: string };
    expect(body.user).toBe('admin');
  });
});
