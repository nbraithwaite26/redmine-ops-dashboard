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
