import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { redmineFetch } from '../src/redmineClient.js';

const REAL_FETCH = globalThis.fetch;

function mockFetchJson(body: unknown) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  ) as unknown as typeof globalThis.fetch;
}

afterEach(() => {
  globalThis.fetch = REAL_FETCH;
});

describe('redmineFetch — cache option (CR #29)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  });

  it('without cache option, every call hits upstream', async () => {
    await redmineFetch('/issues.json');
    await redmineFetch('/issues.json');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('with cache option on a GET, repeated calls share one upstream fetch', async () => {
    const opts = { cache: { key: 'issues:all', ttlMs: 60_000 } };
    await redmineFetch('/issues.json', opts);
    await redmineFetch('/issues.json', opts);
    await redmineFetch('/issues.json', opts);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ignores the cache option for non-GET methods', async () => {
    const opts = {
      method: 'POST' as const,
      body: { foo: 1 },
      cache: { key: 'issues:write', ttlMs: 60_000 },
    };
    await redmineFetch('/issues.json', opts);
    await redmineFetch('/issues.json', opts);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('serves stale data within staleMs and refreshes in background', async () => {
    vi.useFakeTimers();
    try {
      let payload = { v: 1 };
      globalThis.fetch = vi.fn(
        async () =>
          new Response(JSON.stringify(payload), { status: 200 }),
      ) as unknown as typeof globalThis.fetch;

      const opts = { cache: { key: 'swr:k', ttlMs: 1000, staleMs: 60_000 } };
      const first = await redmineFetch<{ v: number }>('/x.json', opts);
      expect(first).toEqual({ v: 1 });

      // Past TTL, inside stale window
      vi.advanceTimersByTime(2000);
      payload = { v: 2 };
      const stale = await redmineFetch<{ v: number }>('/x.json', opts);
      expect(stale).toEqual({ v: 1 }); // stale returned synchronously

      await vi.runAllTimersAsync(); // let background refresh complete

      const fresh = await redmineFetch<{ v: number }>('/x.json', opts);
      expect(fresh).toEqual({ v: 2 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('coalesces concurrent cached GETs into a single upstream call', async () => {
    let resolve!: (r: Response) => void;
    globalThis.fetch = vi.fn(
      () =>
        new Promise<Response>((res) => {
          resolve = res;
        }),
    ) as unknown as typeof globalThis.fetch;

    const opts = { cache: { key: 'coalesce:k', ttlMs: 60_000 } };
    const a = redmineFetch('/x.json', opts);
    const b = redmineFetch('/x.json', opts);
    const c = redmineFetch('/x.json', opts);

    resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await Promise.all([a, b, c]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('preserves backward-compatible behavior when cache option is absent (smoke)', async () => {
    globalThis.fetch = mockFetchJson({ users: [{ id: 1 }] });
    const out = await redmineFetch<{ users: { id: number }[] }>('/users.json');
    expect(out).toEqual({ users: [{ id: 1 }] });
  });
});
