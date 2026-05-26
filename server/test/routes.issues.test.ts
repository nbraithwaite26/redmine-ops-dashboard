import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { requestId } from '../src/middleware/requestId.js';
import { readOnly } from '../src/middleware/readOnly.js';
import issuesRoute from '../src/routes/issues.js';
import issueFixture from './fixtures/issue.detail.json' with { type: 'json' };

const REAL_FETCH = globalThis.fetch;

function makeApp() {
  const app = new Hono();
  app.use('*', requestId());
  app.use('*', readOnly());
  app.route('/issues', issuesRoute);
  return app;
}

describe('GET /issues/:id', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(issueFixture), { status: 200 });
    }) as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = REAL_FETCH;
  });

  it('returns a camelCase normalized issue', async () => {
    const res = await makeApp().request('/issues/1001');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(1001);
    expect(body.startDate).toBe('2026-05-01');
    expect(body.dueDate).toBe('2026-05-20');
    expect(body.parentIssueId).toBe(999);
    expect(body.estimatedHours).toBe(8.5);

    // no snake_case keys on the wire
    const text = JSON.stringify(body);
    for (const k of [
      'start_date',
      'due_date',
      'estimated_hours',
      'done_ratio',
      'parent_issue_id',
      'custom_fields',
    ]) {
      expect(text).not.toContain(`"${k}"`);
    }
  });

  it('asks Redmine to include children, relations, journals, attachments', async () => {
    await makeApp().request('/issues/1001');
    const fetchMock = globalThis.fetch as unknown as { mock: { calls: [string][] } };
    const calledUrl = fetchMock.mock.calls[0]![0]!;
    expect(calledUrl).toContain('/issues/1001.json');
    expect(calledUrl).toContain('include=');
    expect(decodeURIComponent(calledUrl)).toContain('children,relations,journals,attachments');
  });
});

describe('Read-only middleware on issues group', () => {
  it('blocks PATCH with 403 READ_ONLY', async () => {
    const res = await makeApp().request('/issues/1001', { method: 'PATCH' });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('READ_ONLY');
  });

  it('blocks POST with 403 READ_ONLY', async () => {
    const res = await makeApp().request('/issues', { method: 'POST' });
    expect(res.status).toBe(403);
  });
});
