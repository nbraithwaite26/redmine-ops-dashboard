import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { requestId } from '../src/middleware/requestId.js';
import meRoute from '../src/routes/me.js';
import userFixture from './fixtures/user.current.json' with { type: 'json' };

const REAL_FETCH = globalThis.fetch;

function makeApp() {
  const app = new Hono();
  app.use('*', requestId());
  app.route('/me', meRoute);
  return app;
}

describe('GET /me', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(userFixture), { status: 200 });
    }) as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = REAL_FETCH;
  });

  it('returns the normalized current user', async () => {
    const res = await makeApp().request('/me');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: number; name: string; login: string };
    expect(body.id).toBe(42);
    expect(body.name).toBe('Test One');
    expect(body.login).toBe('test.user');
  });

  it('sends X-Redmine-API-Key header to Redmine and never echoes it back', async () => {
    const res = await makeApp().request('/me');
    const call = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]!;
    const init = call[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Redmine-API-Key']).toBe('test-key');

    const text = await res.text();
    expect(text).not.toContain('test-key');
  });
});
