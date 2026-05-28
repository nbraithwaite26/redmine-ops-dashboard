import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { requestId } from '../src/middleware/requestId.js';
import ganttRoute from '../src/routes/gantt.js';

const REAL_FETCH = globalThis.fetch;

function makeApp() {
  const app = new Hono();
  app.use('*', requestId());
  app.route('/gantt', ganttRoute);
  return app;
}

function makeIssue(id: number) {
  return {
    id,
    project: { id: 127, name: 'AIRCRAFT ENGINEERING' },
    tracker: { name: 'Task' },
    status: { name: 'New' },
    priority: { name: 'Normal' },
    subject: `Issue ${id}`,
    author: { id: 1, name: 'Test One' },
    start_date: '2026-05-01',
    due_date: '2026-05-10',
    estimated_hours: 8,
    created_on: '2026-04-01',
    updated_on: '2026-05-01',
  };
}

describe('GET /gantt', () => {
  let capturedUrls: string[] = [];

  beforeEach(() => {
    capturedUrls = [];
    const TOTAL = 150; // forces two pages (100 + 50)
    globalThis.fetch = vi.fn(async (input: string | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      capturedUrls.push(url);
      const parsed = new URL(url);
      const offset = Number(parsed.searchParams.get('offset') ?? '0');
      const limit = Number(parsed.searchParams.get('limit') ?? '100');
      const remaining = Math.max(0, TOTAL - offset);
      const count = Math.min(limit, remaining);
      const issues = Array.from({ length: count }, (_, i) => makeIssue(offset + i + 1));
      return new Response(
        JSON.stringify({ issues, total_count: TOTAL, offset, limit }),
        { status: 200 },
      );
    }) as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = REAL_FETCH;
  });

  it('paginates through all issues (two pages for 150 total)', async () => {
    const res = await makeApp().request('/gantt');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; total: number };
    expect(body.total).toBe(150);
    expect(capturedUrls).toHaveLength(2);
    expect(capturedUrls[0]).toContain('offset=0');
    expect(capturedUrls[1]).toContain('offset=100');
  });

  it('forwards a project_id filter to Redmine when supplied', async () => {
    await makeApp().request('/gantt?project_id=127');
    expect(capturedUrls[0]).toContain('project_id=127');
  });
});

describe('GET /gantt — parallel pagination (CR #29)', () => {
  afterEach(() => {
    globalThis.fetch = REAL_FETCH;
  });

  it('dispatches pages 1..N in parallel after learning total_count from page 0', async () => {
    let resolvePage0!: (r: Response) => void;
    const remainingResolvers: Array<(r: Response) => void> = [];
    const calls: string[] = [];
    const TOTAL = 350; // 4 pages

    globalThis.fetch = vi.fn(async (input: string | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      calls.push(url);
      const offset = Number(new URL(url).searchParams.get('offset') ?? '0');
      if (offset === 0) {
        return new Promise<Response>((res) => {
          resolvePage0 = res;
        });
      }
      return new Promise<Response>((res) => {
        remainingResolvers.push(res);
      });
    }) as unknown as typeof globalThis.fetch;

    const responsePromise = makeApp().request('/gantt');

    // Yield until the handler has dispatched page 0 and is awaiting it.
    while (calls.length === 0) await new Promise((r) => setImmediate(r));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('offset=0');

    // Resolve page 0 — the worker pool should now dispatch pages 1, 2, 3
    // in parallel (3 pages, CONCURRENCY=4 → all three in flight).
    const page0Issues = Array.from({ length: 100 }, (_, i) => makeIssue(i + 1));
    resolvePage0(
      new Response(
        JSON.stringify({ issues: page0Issues, total_count: TOTAL, offset: 0, limit: 100 }),
        { status: 200 },
      ),
    );

    while (remainingResolvers.length < 3) {
      await new Promise((r) => setImmediate(r));
    }
    expect(calls).toHaveLength(4);
    const offsets = calls.map((u) => new URL(u).searchParams.get('offset')).sort();
    expect(offsets).toEqual(['0', '100', '200', '300']);

    // Resolve them all.
    for (let i = 0; i < 3; i += 1) {
      const offset = (i + 1) * 100;
      const count = Math.min(100, TOTAL - offset);
      const issues = Array.from({ length: count }, (_, j) => makeIssue(offset + j + 1));
      remainingResolvers[i]!(
        new Response(
          JSON.stringify({ issues, total_count: TOTAL, offset, limit: 100 }),
          { status: 200 },
        ),
      );
    }

    const res = await responsePromise;
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number };
    expect(body.total).toBe(TOTAL);
  });

  it('caches the derived gantt payload — a second identical request hits no upstream', async () => {
    const TOTAL = 50; // single page
    let callCount = 0;
    globalThis.fetch = vi.fn(async (input: string | URL) => {
      callCount += 1;
      const url = typeof input === 'string' ? input : input.toString();
      const offset = Number(new URL(url).searchParams.get('offset') ?? '0');
      const issues = Array.from({ length: 50 }, (_, i) => makeIssue(offset + i + 1));
      return new Response(
        JSON.stringify({ issues, total_count: TOTAL, offset, limit: 100 }),
        { status: 200 },
      );
    }) as unknown as typeof globalThis.fetch;

    const res1 = await makeApp().request('/gantt?project_id=127');
    expect(res1.status).toBe(200);
    const after1 = callCount;
    expect(after1).toBeGreaterThan(0);

    const res2 = await makeApp().request('/gantt?project_id=127');
    expect(res2.status).toBe(200);
    expect(callCount).toBe(after1); // cache hit, no new upstream calls
  });

  it('keys the cache by filter set — different filters miss cache', async () => {
    const TOTAL = 50;
    let callCount = 0;
    globalThis.fetch = vi.fn(async (input: string | URL) => {
      callCount += 1;
      const url = typeof input === 'string' ? input : input.toString();
      const offset = Number(new URL(url).searchParams.get('offset') ?? '0');
      const issues = Array.from({ length: 50 }, (_, i) => makeIssue(offset + i + 1));
      return new Response(
        JSON.stringify({ issues, total_count: TOTAL, offset, limit: 100 }),
        { status: 200 },
      );
    }) as unknown as typeof globalThis.fetch;

    await makeApp().request('/gantt?project_id=127');
    const after1 = callCount;
    await makeApp().request('/gantt?project_id=200');
    expect(callCount).toBeGreaterThan(after1);
  });
});
