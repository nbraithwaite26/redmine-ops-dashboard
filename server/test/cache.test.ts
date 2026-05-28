import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureCache,
  getCacheStats,
  getOrFetch,
  invalidate,
  resetCache,
} from '../src/cache.js';

beforeEach(() => {
  resetCache();
  configureCache({ maxEntries: 500, maxBytesPerEntry: 1_000_000 });
});

afterEach(() => {
  vi.useRealTimers();
  resetCache();
});

describe('cache.getOrFetch — TTL', () => {
  it('returns the fetcher result on miss and caches it for next call', async () => {
    const fetcher = vi.fn(async () => ({ value: 1 }));
    const a = await getOrFetch('k', 60_000, fetcher);
    const b = await getOrFetch('k', 60_000, fetcher);
    expect(a).toEqual({ value: 1 });
    expect(b).toEqual({ value: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const s = getCacheStats();
    expect(s.misses).toBe(1);
    expect(s.hits).toBe(1);
  });

  it('re-fetches once the TTL window has expired', async () => {
    vi.useFakeTimers();
    let n = 0;
    const fetcher = vi.fn(async () => ({ v: ++n }));
    const first = await getOrFetch('k', 1000, fetcher);
    expect(first).toEqual({ v: 1 });
    vi.advanceTimersByTime(1500);
    const second = await getOrFetch('k', 1000, fetcher);
    expect(second).toEqual({ v: 2 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('cache.getOrFetch — in-flight coalescing', () => {
  it('coalesces concurrent misses into a single fetch', async () => {
    let resolve!: (v: { v: number }) => void;
    const inflight = new Promise<{ v: number }>((res) => {
      resolve = res;
    });
    const fetcher = vi.fn(() => inflight);

    const a = getOrFetch('k', 60_000, fetcher);
    const b = getOrFetch('k', 60_000, fetcher);
    const c = getOrFetch('k', 60_000, fetcher);

    resolve({ v: 42 });

    expect(await a).toEqual({ v: 42 });
    expect(await b).toEqual({ v: 42 });
    expect(await c).toEqual({ v: 42 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(getCacheStats().coalesced).toBe(2); // first is a miss, next two coalesce
  });

  it('does not coalesce after the in-flight promise resolves', async () => {
    const fetcher = vi.fn(async () => 'x');
    await getOrFetch('k', 60_000, fetcher);
    await getOrFetch('k', 60_000, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(getCacheStats().coalesced).toBe(0);
  });
});

describe('cache.getOrFetch — stale-while-revalidate', () => {
  it('serves stale data inside the SWR window and refreshes in the background', async () => {
    vi.useFakeTimers();
    let n = 0;
    const fetcher = vi.fn(async () => ({ v: ++n }));

    await getOrFetch('k', 1000, fetcher, { staleMs: 60_000 });
    expect(fetcher).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2000); // past TTL, inside stale window

    const stale = await getOrFetch('k', 1000, fetcher, { staleMs: 60_000 });
    expect(stale).toEqual({ v: 1 }); // stale wins synchronously
    expect(getCacheStats().staleHits).toBe(1);

    // Let the background refresh resolve + store
    await vi.runAllTimersAsync();
    expect(fetcher).toHaveBeenCalledTimes(2);

    // Subsequent call inside the new TTL sees the refreshed data
    const fresh = await getOrFetch('k', 1000, fetcher, { staleMs: 60_000 });
    expect(fresh).toEqual({ v: 2 });
  });

  it('re-fetches synchronously once the entry is past TTL + staleMs', async () => {
    vi.useFakeTimers();
    let n = 0;
    const fetcher = vi.fn(async () => ({ v: ++n }));
    await getOrFetch('k', 1000, fetcher, { staleMs: 1000 });
    vi.advanceTimersByTime(3000); // past both windows
    const result = await getOrFetch('k', 1000, fetcher, { staleMs: 1000 });
    expect(result).toEqual({ v: 2 });
    expect(getCacheStats().staleHits).toBe(0);
  });

  it('does not schedule a second background refresh when one is in flight', async () => {
    vi.useFakeTimers();
    let resolve!: (v: number) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<number>((res) => {
          resolve = res;
        }),
    );

    // Seed the cache
    const seedPromise = getOrFetch('k', 1000, fetcher, { staleMs: 60_000 });
    resolve(1);
    await seedPromise;

    vi.advanceTimersByTime(2000);

    // Two stale reads in a row — only one background refresh should be scheduled
    let resolve2!: (v: number) => void;
    fetcher.mockImplementationOnce(
      () =>
        new Promise<number>((res) => {
          resolve2 = res;
        }),
    );
    await getOrFetch('k', 1000, fetcher, { staleMs: 60_000 });
    await getOrFetch('k', 1000, fetcher, { staleMs: 60_000 });
    expect(fetcher).toHaveBeenCalledTimes(2); // seed + one refresh; second stale read piggybacks
    resolve2(2);
  });
});

describe('cache.invalidate', () => {
  it('clears everything when called with no argument', async () => {
    await getOrFetch('a', 60_000, async () => 1);
    await getOrFetch('b', 60_000, async () => 2);
    expect(invalidate()).toBe(2);
    expect(getCacheStats().size).toBe(0);
  });

  it('clears only keys matching a prefix', async () => {
    await getOrFetch('issues:1', 60_000, async () => 'a');
    await getOrFetch('issues:2', 60_000, async () => 'b');
    await getOrFetch('projects:1', 60_000, async () => 'c');
    expect(invalidate('issues:')).toBe(2);
    expect(getCacheStats().size).toBe(1);
  });

  it('tolerates a trailing * in the prefix', async () => {
    await getOrFetch('issues:1', 60_000, async () => 'a');
    await getOrFetch('issues:2', 60_000, async () => 'b');
    expect(invalidate('issues:*')).toBe(2);
  });
});

describe('cache — LRU eviction', () => {
  it('evicts the oldest entry when capacity is exceeded', async () => {
    configureCache({ maxEntries: 3 });
    await getOrFetch('a', 60_000, async () => 'A');
    await getOrFetch('b', 60_000, async () => 'B');
    await getOrFetch('c', 60_000, async () => 'C');
    await getOrFetch('d', 60_000, async () => 'D');
    expect(getCacheStats().size).toBe(3);
    expect(getCacheStats().evictions).toBe(1);

    const aFetcher = vi.fn(async () => 'A2');
    await getOrFetch('a', 60_000, aFetcher);
    expect(aFetcher).toHaveBeenCalledTimes(1); // a was evicted, this is a miss
  });

  it('touches LRU order on hit (recently-read entries survive eviction)', async () => {
    configureCache({ maxEntries: 3 });
    await getOrFetch('a', 60_000, async () => 'A');
    await getOrFetch('b', 60_000, async () => 'B');
    await getOrFetch('c', 60_000, async () => 'C');
    // Read 'a' to move it to the tail
    await getOrFetch('a', 60_000, async () => 'A');
    // 'd' should evict the oldest remaining, which is now 'b'
    await getOrFetch('d', 60_000, async () => 'D');

    const aFetcher = vi.fn(async () => 'A2');
    await getOrFetch('a', 60_000, aFetcher);
    expect(aFetcher).not.toHaveBeenCalled(); // a still cached

    const bFetcher = vi.fn(async () => 'B2');
    await getOrFetch('b', 60_000, bFetcher);
    expect(bFetcher).toHaveBeenCalledTimes(1); // b was the eviction victim
  });
});

describe('cache — size guard', () => {
  it('refuses to cache payloads larger than maxBytesPerEntry', async () => {
    configureCache({ maxBytesPerEntry: 50 });
    const big = { huge: 'x'.repeat(200) };
    const fetcher = vi.fn(async () => big);

    const first = await getOrFetch('big', 60_000, fetcher);
    expect(first).toEqual(big); // caller still gets the data

    const second = await getOrFetch('big', 60_000, fetcher);
    expect(second).toEqual(big);
    expect(fetcher).toHaveBeenCalledTimes(2); // not cached, refetched
    expect(getCacheStats().rejectedTooLarge).toBe(2); // one rejection per store attempt
    expect(getCacheStats().size).toBe(0);
  });

  it('refuses to cache unserializable payloads (circular refs)', async () => {
    type CircNode = { self?: CircNode };
    const circ: CircNode = {};
    circ.self = circ;
    const fetcher = vi.fn(async () => circ);

    await getOrFetch('c', 60_000, fetcher);
    await getOrFetch('c', 60_000, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(getCacheStats().rejectedTooLarge).toBe(2);
  });
});

describe('cache — resetCache', () => {
  it('clears entries, pending, and stats counters', async () => {
    await getOrFetch('a', 60_000, async () => 1);
    expect(getCacheStats().misses).toBe(1);
    resetCache();
    const s = getCacheStats();
    expect(s.size).toBe(0);
    expect(s.hits).toBe(0);
    expect(s.misses).toBe(0);
  });
});
