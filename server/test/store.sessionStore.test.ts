import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Two-branch coverage for the session store: the in-memory fallback (default)
 * and the Redis branch (REDIS_URL set, ioredis mocked).
 */

interface StubCall {
  cmd: string;
  args: unknown[];
}

function makeRedisStub() {
  const data = new Map<string, { value: string; expiresAt: number }>();
  const calls: StubCall[] = [];
  const record = (cmd: string, args: unknown[]) => calls.push({ cmd, args });

  const stub = {
    on: vi.fn(),
    async set(key: string, value: string, _ex: string, ttlSec: number) {
      record('set', [key, value, _ex, ttlSec]);
      data.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
      return 'OK';
    },
    async get(key: string) {
      record('get', [key]);
      const entry = data.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        data.delete(key);
        return null;
      }
      return entry.value;
    },
    async ttl(key: string) {
      record('ttl', [key]);
      const entry = data.get(key);
      if (!entry) return -2;
      return Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
    },
    async expire(key: string, ttlSec: number) {
      record('expire', [key, ttlSec]);
      const entry = data.get(key);
      if (!entry) return 0;
      entry.expiresAt = Date.now() + ttlSec * 1000;
      return 1;
    },
    async del(key: string) {
      record('del', [key]);
      return data.delete(key) ? 1 : 0;
    },
    async incr(key: string) {
      record('incr', [key]);
      const entry = data.get(key);
      const n = entry ? Number(entry.value) + 1 : 1;
      data.set(key, { value: String(n), expiresAt: entry?.expiresAt ?? Date.now() + 60_000 });
      return n;
    },
  };
  return { stub, calls, data };
}

describe('sessionStore — in-memory fallback (no REDIS_URL)', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.REDIS_URL;
  });

  it('round-trips create → get → refresh → destroy without Redis', async () => {
    const store = await import('../src/store/sessionStore.js');
    store.__clearMemSessions();
    const created = await store.createSession('alice');
    expect(created.user).toBe('alice');

    const fetched = await store.getSession(created.id);
    expect(fetched?.user).toBe('alice');

    const refreshed = await store.refreshSession(created.id);
    expect(refreshed).not.toBeNull();
    expect(refreshed!.expiresAt).toBeGreaterThanOrEqual(created.expiresAt);

    await store.destroySession(created.id);
    expect(await store.getSession(created.id)).toBeNull();
  });

  it('returns null for unknown id', async () => {
    const store = await import('../src/store/sessionStore.js');
    expect(await store.getSession('does-not-exist')).toBeNull();
    expect(await store.refreshSession('does-not-exist')).toBeNull();
  });
});

describe('sessionStore — Redis branch (REDIS_URL set, ioredis mocked)', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.REDIS_URL = 'redis://localhost:6379';
  });

  afterEach(() => {
    delete process.env.REDIS_URL;
    vi.doUnmock('ioredis');
  });

  it('writes session via SET … EX <ttl> and reads back via GET', async () => {
    const { stub, calls } = makeRedisStub();
    vi.doMock('ioredis', () => ({ default: vi.fn(() => stub) }));

    const store = await import('../src/store/sessionStore.js');
    const created = await store.createSession('alice');

    const setCall = calls.find((c) => c.cmd === 'set');
    expect(setCall).toBeTruthy();
    expect(setCall!.args[0]).toBe(`session:${created.id}`);
    expect(setCall!.args[2]).toBe('EX');
    expect(setCall!.args[3]).toBe(12 * 60 * 60);

    const fetched = await store.getSession(created.id);
    expect(fetched?.user).toBe('alice');
    expect(calls.some((c) => c.cmd === 'get')).toBe(true);
  });

  it('refreshSession calls EXPIRE and returns null for missing key', async () => {
    const { stub, calls } = makeRedisStub();
    vi.doMock('ioredis', () => ({ default: vi.fn(() => stub) }));

    const store = await import('../src/store/sessionStore.js');
    const created = await store.createSession('bob');
    calls.length = 0;

    const refreshed = await store.refreshSession(created.id);
    expect(refreshed?.user).toBe('bob');
    expect(calls.some((c) => c.cmd === 'expire')).toBe(true);

    const ghost = await store.refreshSession('missing-id');
    expect(ghost).toBeNull();
  });

  it('destroySession issues DEL', async () => {
    const { stub, calls } = makeRedisStub();
    vi.doMock('ioredis', () => ({ default: vi.fn(() => stub) }));

    const store = await import('../src/store/sessionStore.js');
    const created = await store.createSession('carol');
    await store.destroySession(created.id);
    expect(calls.some((c) => c.cmd === 'del')).toBe(true);
    expect(await store.getSession(created.id)).toBeNull();
  });
});
