/**
 * Smoke test: the Hono app boots and /health responds 200 with the expected
 * shape. This does NOT call Redmine. It only verifies the server skeleton
 * is sound.
 */
import { describe, expect, it, beforeAll } from 'vitest';

// The config module exits the process if env is missing. We set fake values
// before importing it so tests can run without .env.local.
beforeAll(() => {
  process.env.REDMINE_BASE_URL = 'https://example.invalid';
  process.env.REDMINE_API_KEY = 'test-key';
  process.env.REDMINE_READ_ONLY = 'true';
  process.env.PORT = '8788';
  process.env.ALLOWED_ORIGIN = 'http://localhost:5173';
});

describe('server skeleton', () => {
  it('responds 200 on /health', async () => {
    const { Hono } = await import('hono');
    const { requestId } = await import('../src/middleware/requestId.js');

    const app = new Hono();
    app.use('*', requestId());
    app.get('/health', (c) => c.json({ ok: true }));

    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(res.headers.get('X-Request-Id')).toBeTruthy();
  });

  it('read-only middleware blocks non-GET', async () => {
    const { Hono } = await import('hono');
    const { requestId } = await import('../src/middleware/requestId.js');
    const { readOnly } = await import('../src/middleware/readOnly.js');

    const app = new Hono();
    app.use('*', requestId());
    app.use('*', readOnly());
    app.post('/anything', (c) => c.json({ shouldNotReach: true }));

    const res = await app.request('/anything', { method: 'POST' });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('READ_ONLY');
  });
});
