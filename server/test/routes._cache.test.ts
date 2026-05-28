import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { requestId } from '../src/middleware/requestId.js';
import { getOrFetch, getCacheStats } from '../src/cache.js';
import cacheRoute from '../src/routes/_cache.js';

function makeApp() {
  const app = new Hono();
  app.use('*', requestId());
  // No session middleware here — mirrors how the unit test exercises the
  // bare route. The session gate is enforced at the app level in index.ts.
  app.route('/_cache', cacheRoute);
  return app;
}

describe('admin _cache routes (CR #29)', () => {
  it('GET /_cache/stats returns the current counters', async () => {
    await getOrFetch('a', 60_000, async () => 1);
    await getOrFetch('a', 60_000, async () => 1); // hit
    await getOrFetch('b', 60_000, async () => 2); // miss

    const res = await makeApp().request('/_cache/stats');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hits: number; misses: number; size: number };
    expect(body.hits).toBe(1);
    expect(body.misses).toBe(2);
    expect(body.size).toBe(2);
  });

  it('POST /_cache/invalidate clears everything and reports the count', async () => {
    await getOrFetch('a', 60_000, async () => 1);
    await getOrFetch('b', 60_000, async () => 2);
    const res = await makeApp().request('/_cache/invalidate', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { removed: number };
    expect(body.removed).toBe(2);
    expect(getCacheStats().size).toBe(0);
  });

  it('POST /_cache/invalidate?prefix=… clears only matching keys', async () => {
    await getOrFetch('issues:1', 60_000, async () => 'a');
    await getOrFetch('issues:2', 60_000, async () => 'b');
    await getOrFetch('projects:1', 60_000, async () => 'c');
    const res = await makeApp().request('/_cache/invalidate?prefix=issues:', {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { removed: number };
    expect(body.removed).toBe(2);
    expect(getCacheStats().size).toBe(1);
  });
});
