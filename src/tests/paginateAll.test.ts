/**
 * Tests for the parallel `paginateAll` + `dedupedGet` infrastructure in
 * `src/services/realRedmineApi.ts`. We mock `httpGet` at the module boundary
 * so the suite runs in milliseconds without a live network or backend.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockHttpGet = vi.hoisted(() => vi.fn());

vi.mock('../services/http', () => ({
  httpGet: mockHttpGet,
  HttpError: class HttpError extends Error {
    status: number;
    constructor(status: number, _code: string, msg: string) {
      super(msg);
      this.status = status;
    }
  },
  httpJson: vi.fn(),
}));

// Import AFTER the mock is registered.
import { realRedmineApi, dedupedGet, __resetDedupCache } from '../services/realRedmineApi';

beforeEach(() => {
  __resetDedupCache();
  mockHttpGet.mockReset();
});

afterEach(() => {
  __resetDedupCache();
});

function makePage(items: number[], total: number, offset: number) {
  return { items, total, limit: 100, offset };
}

describe('paginateAll (realRedmineApi)', () => {
  it('returns a single page when total fits the first response', async () => {
    mockHttpGet.mockResolvedValueOnce(makePage([1, 2, 3], 3, 0));
    const result = await realRedmineApi.getIssues();
    expect(result).toEqual([1, 2, 3]);
    expect(mockHttpGet).toHaveBeenCalledTimes(1);
    expect(mockHttpGet).toHaveBeenCalledWith('/issues', {
      limit: 100,
      offset: 0,
    });
  });

  it('fetches page 0 first, then remaining pages in parallel', async () => {
    // 250 items → 3 pages: page 0 (sequential), pages 1 + 2 in parallel.
    const order: number[] = [];
    mockHttpGet.mockImplementation(async (_path, q: { offset: number; limit: number }) => {
      order.push(q.offset);
      if (q.offset === 0) {
        return makePage(Array.from({ length: 100 }, (_, i) => i), 250, 0);
      }
      if (q.offset === 100) {
        return makePage(Array.from({ length: 100 }, (_, i) => 100 + i), 250, 100);
      }
      if (q.offset === 200) {
        return makePage(Array.from({ length: 50 }, (_, i) => 200 + i), 250, 200);
      }
      throw new Error(`unexpected offset ${q.offset}`);
    });

    const result = await realRedmineApi.getIssues();
    expect(result).toHaveLength(250);
    expect(result[0]).toBe(0);
    expect(result[249]).toBe(249);
    // Page 0 must be the first call (sequential dependency).
    expect(order[0]).toBe(0);
    // After page 0, pages 1 + 2 fire together.
    expect(order.slice(1).sort((a, b) => a - b)).toEqual([100, 200]);
  });

  it('caps in-flight requests to CONCURRENCY=2 for the remaining pages', async () => {
    // 6 pages total. Page 0 is sequential; pages 1-5 must fan out at most
    // 2-wide. We measure the peak in-flight count via a mocked async
    // implementation that increments on entry and decrements on exit.
    let inFlight = 0;
    let peakAfterPage0 = 0;
    let page0Done = false;
    mockHttpGet.mockImplementation(async (_path, q: { offset: number }) => {
      if (q.offset !== 0) {
        inFlight += 1;
        if (page0Done && inFlight > peakAfterPage0) peakAfterPage0 = inFlight;
      }
      try {
        await new Promise((r) => setTimeout(r, 10));
        if (q.offset === 0) page0Done = true;
        return makePage(
          Array.from({ length: 100 }, (_, i) => q.offset + i),
          600,
          q.offset,
        );
      } finally {
        if (q.offset !== 0) inFlight -= 1;
      }
    });
    const result = await realRedmineApi.getIssues();
    expect(result).toHaveLength(600);
    // CONCURRENCY=2 means peak after page 0 is at most 2.
    expect(peakAfterPage0).toBeLessThanOrEqual(2);
    expect(peakAfterPage0).toBeGreaterThan(0); // and actually fanned out
  });

  it('caps page count via the maxPages safety guard', async () => {
    // Lie about total_count so the safety cap activates. paginateAll is
    // hard-coded to maxPages=50 for /issues; that's 5000 items max.
    mockHttpGet.mockImplementation(async (_path, q: { offset: number; limit: number }) => {
      return makePage(
        Array.from({ length: 100 }, (_, i) => q.offset + i),
        100_000, // huge fake total
        q.offset,
      );
    });
    const result = await realRedmineApi.getIssues();
    // 50 pages × 100 items = 5000.
    expect(result).toHaveLength(5000);
  });

  it('propagates errors from the first page', async () => {
    mockHttpGet.mockRejectedValueOnce(new Error('boom'));
    await expect(realRedmineApi.getIssues()).rejects.toThrow('boom');
  });

  it('forwards filters into every page query', async () => {
    mockHttpGet.mockImplementation(async (_path, q: Record<string, string | number>) => {
      // Single-page response so we can assert query shape easily.
      expect(q.assigned_to_id).toBe('me');
      return makePage([1], 1, Number(q.offset));
    });
    await realRedmineApi.getMyIssues();
    expect(mockHttpGet).toHaveBeenCalledTimes(1);
  });
});

describe('dedupedGet', () => {
  it('coalesces concurrent identical reads into one network call', async () => {
    let resolveOne: ((v: unknown) => void) | null = null;
    mockHttpGet.mockImplementationOnce(
      () => new Promise((resolve) => { resolveOne = resolve; }),
    );

    const a = dedupedGet<{ ok: boolean }>('/projects', { limit: 100, offset: 0 });
    const b = dedupedGet<{ ok: boolean }>('/projects', { limit: 100, offset: 0 });

    // Same in-flight promise instance → no second network call yet.
    expect(mockHttpGet).toHaveBeenCalledTimes(1);
    resolveOne!({ ok: true });
    await expect(a).resolves.toEqual({ ok: true });
    await expect(b).resolves.toEqual({ ok: true });
  });

  it('does not coalesce different query shapes', async () => {
    mockHttpGet.mockResolvedValue({ ok: true });
    const a = dedupedGet('/projects', { limit: 100, offset: 0 });
    const b = dedupedGet('/projects', { limit: 100, offset: 100 });
    await Promise.all([a, b]);
    expect(mockHttpGet).toHaveBeenCalledTimes(2);
  });

  it('removes the in-flight entry once the promise settles', async () => {
    mockHttpGet
      .mockResolvedValueOnce({ ok: 1 })
      .mockResolvedValueOnce({ ok: 2 });
    await dedupedGet('/groups');
    // After settle, a second identical call must trigger a new fetch.
    await dedupedGet('/groups');
    expect(mockHttpGet).toHaveBeenCalledTimes(2);
  });

  it('still drops the in-flight entry on rejection', async () => {
    mockHttpGet
      .mockRejectedValueOnce(new Error('first fail'))
      .mockResolvedValueOnce({ ok: true });
    await expect(dedupedGet('/me')).rejects.toThrow('first fail');
    // After settle, next call should refetch.
    await expect(dedupedGet('/me')).resolves.toEqual({ ok: true });
    expect(mockHttpGet).toHaveBeenCalledTimes(2);
  });
});
