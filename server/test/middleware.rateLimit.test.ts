import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { AppEnv } from '../src/types/appVars.js';

async function makeApp() {
  const { requestId } = await import('../src/middleware/requestId.js');
  const { rateLimit } = await import('../src/middleware/rateLimit.js');
  const app = new Hono<AppEnv>();
  app.use('*', requestId());
  app.use('*', rateLimit());
  app.get('/ping', (c) => c.json({ ok: true }));
  return app;
}

describe('rateLimit middleware — in-memory fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.REDIS_URL;
  });

  it('passes a single request through', async () => {
    const app = await makeApp();
    const { __clearMemBuckets } = await import('../src/middleware/rateLimit.js');
    __clearMemBuckets();
    const res = await app.request('/ping');
    expect(res.status).toBe(200);
  });

  it('429s once the bucket is exhausted', async () => {
    // Freeze time so the bucket can't refill while the loop drains it.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-28T12:00:00Z'));
    try {
      const app = await makeApp();
      const { __clearMemBuckets } = await import('../src/middleware/rateLimit.js');
      __clearMemBuckets();
      // BURST = 200; the 201st should be rejected.
      for (let i = 0; i < 200; i += 1) {
        const ok = await app.request('/ping', { headers: { 'x-real-ip': '5.5.5.5' } });
        expect(ok.status).toBe(200);
      }
      const blocked = await app.request('/ping', { headers: { 'x-real-ip': '5.5.5.5' } });
      expect(blocked.status).toBe(429);
      const body = (await blocked.json()) as { error: { code: string } };
      expect(body.error.code).toBe('RATE_LIMITED');
    } finally {
      vi.useRealTimers();
    }
  });

  it('bypasses the rate limit when the x-internal-warmer header is present', async () => {
    const app = await makeApp();
    const { __clearMemBuckets } = await import('../src/middleware/rateLimit.js');
    __clearMemBuckets();
    // Drain past the new burst ceiling — would normally 429 — but the
    // warmer-flagged request still passes.
    for (let i = 0; i < 300; i += 1) {
      const ok = await app.request('/ping', {
        headers: { 'x-real-ip': '5.5.5.5', 'x-internal-warmer': '1' },
      });
      expect(ok.status).toBe(200);
    }
  });
});

describe('rateLimit middleware — Redis branch (REDIS_URL set, ioredis mocked)', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.REDIS_URL = 'redis://localhost:6379';
  });

  afterEach(() => {
    delete process.env.REDIS_URL;
    vi.doUnmock('ioredis');
  });

  it('uses INCR + EXPIRE for the per-second window key', async () => {
    const calls: { cmd: string; args: unknown[] }[] = [];
    let counter = 0;
    const stub = {
      on: vi.fn(),
      async incr(key: string) {
        calls.push({ cmd: 'incr', args: [key] });
        counter += 1;
        return counter;
      },
      async expire(key: string, sec: number) {
        calls.push({ cmd: 'expire', args: [key, sec] });
        return 1;
      },
    };
    vi.doMock('ioredis', () => ({ default: vi.fn(() => stub) }));

    const app = await makeApp();
    const res = await app.request('/ping', { headers: { 'x-real-ip': '9.9.9.9' } });
    expect(res.status).toBe(200);

    const incrCall = calls.find((c) => c.cmd === 'incr');
    expect(incrCall, 'INCR should have fired').toBeTruthy();
    expect((incrCall!.args[0] as string).startsWith('rl:9.9.9.9:')).toBe(true);
    // EXPIRE only on first hit in a window (count === 1)
    expect(calls.some((c) => c.cmd === 'expire')).toBe(true);
  });

  it('429s when INCR count exceeds the burst ceiling', async () => {
    let counter = 0;
    const stub = {
      on: vi.fn(),
      async incr() {
        counter += 1;
        return counter;
      },
      async expire() {
        return 1;
      },
    };
    vi.doMock('ioredis', () => ({ default: vi.fn(() => stub) }));

    const app = await makeApp();
    // BURST = 200, so simulate 201 hits via the mocked counter.
    for (let i = 0; i < 200; i += 1) {
      const ok = await app.request('/ping', { headers: { 'x-real-ip': '8.8.8.8' } });
      expect(ok.status).toBe(200);
    }
    const blocked = await app.request('/ping', { headers: { 'x-real-ip': '8.8.8.8' } });
    expect(blocked.status).toBe(429);
  });
});
