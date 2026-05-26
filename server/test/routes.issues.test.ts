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

/** Same routes but without readOnly middleware — for exercising PATCH handler. */
function makeWritableApp() {
  const app = new Hono();
  app.use('*', requestId());
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

describe('PATCH /issues/:id', () => {
  // Fixtures used by the PATCH happy-path test below.
  const statusesPayload = {
    issue_statuses: [
      { id: 1, name: 'New' },
      { id: 2, name: 'In Progress' },
      { id: 3, name: 'Resolved' },
    ],
  };
  const prioritiesPayload = {
    issue_priorities: [
      { id: 5, name: 'Low' },
      { id: 6, name: 'Normal' },
      { id: 7, name: 'High' },
    ],
  };

  afterEach(() => {
    globalThis.fetch = REAL_FETCH;
  });

  it('returns 400 BAD_REQUEST when the body is empty', async () => {
    const res = await makeWritableApp().request('/issues/1001', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 400 BAD_REQUEST when an unknown field is sent', async () => {
    const res = await makeWritableApp().request('/issues/1001', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ unknownThing: 'x' }),
    });
    expect(res.status).toBe(400);
  });

  it('forwards customFields as snake_case custom_fields with string-coerced values', async () => {
    const calls: Array<{ url: string; method: string; body: string | undefined }> = [];
    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? init.body : undefined;
      calls.push({ url, method, body });
      if (method === 'PUT' && url.includes('/issues/1001.json')) {
        return new Response(null, { status: 204 });
      }
      if (method === 'GET' && url.includes('/issues/1001.json')) {
        return new Response(JSON.stringify(issueFixture), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    }) as unknown as typeof globalThis.fetch;

    const res = await makeWritableApp().request('/issues/1001', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customFields: [
          { id: 1, value: 'Updated Anonymized text' },
          { id: 7, value: 42 },
          { id: 8, value: true },
          { id: 9, value: false },
          { id: 10, value: null },
        ],
      }),
    });
    expect(res.status).toBe(200);

    const putCall = calls.find((c) => c.method === 'PUT')!;
    const sent = JSON.parse(putCall.body!) as { issue: Record<string, unknown> };
    const cf = sent.issue.custom_fields as Array<{ id: number; value: string }>;
    expect(cf).toEqual([
      { id: 1, value: 'Updated Anonymized text' },
      { id: 7, value: '42' },
      { id: 8, value: '1' },
      { id: 9, value: '0' },
      { id: 10, value: '' }, // null clears the field
    ]);
    // camelCase key must not leak through.
    expect(sent.issue.customFields).toBeUndefined();
  });

  it('rejects customFields with malformed entries (zod allowlist)', async () => {
    const res = await makeWritableApp().request('/issues/1001', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customFields: [{ id: 'not-a-number', value: 'x' }],
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('PUTs the camel→snake mapped body to Redmine and returns the refetched issue', async () => {
    const calls: Array<{ url: string; method: string; body: string | undefined }> = [];
    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? init.body : undefined;
      calls.push({ url, method, body });
      if (url.includes('/issue_statuses.json')) {
        return new Response(JSON.stringify(statusesPayload), { status: 200 });
      }
      if (url.includes('/enumerations/issue_priorities.json')) {
        return new Response(JSON.stringify(prioritiesPayload), { status: 200 });
      }
      if (url.includes(`/issues/1001.json`) && method === 'PUT') {
        return new Response(null, { status: 204 });
      }
      if (url.includes(`/issues/1001.json`) && method === 'GET') {
        return new Response(JSON.stringify(issueFixture), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    }) as unknown as typeof globalThis.fetch;

    const res = await makeWritableApp().request('/issues/1001', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subject: 'Updated subject',
        status: 'In Progress',
        priority: 'High',
        doneRatio: 75,
        assignedToId: 42,
        dueDate: '2026-06-30',
        notes: 'Bumped priority',
      }),
    });
    expect(res.status).toBe(200);

    const putCall = calls.find((c) => c.method === 'PUT')!;
    expect(putCall).toBeDefined();
    const sent = JSON.parse(putCall.body!) as { issue: Record<string, unknown> };
    expect(sent.issue.subject).toBe('Updated subject');
    expect(sent.issue.status_id).toBe(2); // 'In Progress'
    expect(sent.issue.priority_id).toBe(7); // 'High'
    expect(sent.issue.done_ratio).toBe(75);
    expect(sent.issue.assigned_to_id).toBe(42);
    expect(sent.issue.due_date).toBe('2026-06-30');
    expect(sent.issue.notes).toBe('Bumped priority');
    // camelCase keys must not leak through to Redmine
    expect(sent.issue.assignedToId).toBeUndefined();
    expect(sent.issue.doneRatio).toBeUndefined();

    const refetched = (await res.json()) as { id: number; subject: string };
    expect(refetched.id).toBe(1001);
  });

  it('returns 422 BAD_REQUEST for unknown status name', async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/issue_statuses.json')) {
        return new Response(JSON.stringify(statusesPayload), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof globalThis.fetch;

    const res = await makeWritableApp().request('/issues/1001', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'Definitely Not A Status' }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.message).toMatch(/unknown status/i);
  });

  it('passes through Redmine 404 as 404 NOT_FOUND', async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if ((init?.method ?? 'GET') === 'PUT' && url.includes('/issues/9999.json')) {
        return new Response(JSON.stringify({ errors: ['Not found'] }), { status: 404 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof globalThis.fetch;

    const res = await makeWritableApp().request('/issues/9999', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: 'x' }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('passes Redmine 422 through as 422 UPSTREAM_ERROR (status path)', async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if ((init?.method ?? 'GET') === 'PUT') {
        return new Response(
          JSON.stringify({ errors: ['Subject is invalid'] }),
          { status: 422 },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof globalThis.fetch;

    const res = await makeWritableApp().request('/issues/1001', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: '' }),
    });
    // The empty-string subject is rejected by zod first → 400
    // but Redmine 422 path is exercised when zod passes. Send a valid
    // subject + force Redmine to reject:
    expect([400, 422]).toContain(res.status);

    const res2 = await makeWritableApp().request('/issues/1001', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: 'Valid subject' }),
    });
    expect(res2.status).toBe(422);
    const body = (await res2.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('UPSTREAM_ERROR');
    expect(body.error.message).toContain('Subject is invalid');
  });
});

describe('POST /issues (create)', () => {
  const statusesPayload = {
    issue_statuses: [
      { id: 1, name: 'New' },
      { id: 2, name: 'In Progress' },
    ],
  };

  afterEach(() => {
    globalThis.fetch = REAL_FETCH;
  });

  it('returns 400 when projectId is missing', async () => {
    const res = await makeWritableApp().request('/issues', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: 'A new task' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when subject is empty', async () => {
    const res = await makeWritableApp().request('/issues', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: 7, subject: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('POSTs the camel→snake mapped body and returns 201 with the created issue', async () => {
    const calls: Array<{ url: string; method: string; body: string | undefined }> = [];
    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? init.body : undefined;
      calls.push({ url, method, body });
      if (url.includes('/issue_statuses.json')) {
        return new Response(JSON.stringify(statusesPayload), { status: 200 });
      }
      if (url.endsWith('/issues.json') && method === 'POST') {
        return new Response(JSON.stringify(issueFixture), { status: 201 });
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    }) as unknown as typeof globalThis.fetch;

    const res = await makeWritableApp().request('/issues', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: 7,
        subject: 'A new task',
        status: 'In Progress',
        assignedToId: 42,
        dueDate: '2026-06-30',
      }),
    });
    expect(res.status).toBe(201);

    const postCall = calls.find((c) => c.method === 'POST')!;
    const sent = JSON.parse(postCall.body!) as { issue: Record<string, unknown> };
    expect(sent.issue.project_id).toBe(7);
    expect(sent.issue.subject).toBe('A new task');
    expect(sent.issue.status_id).toBe(2);
    expect(sent.issue.assigned_to_id).toBe(42);
    expect(sent.issue.due_date).toBe('2026-06-30');
    expect(sent.issue.projectId).toBeUndefined();

    const body = (await res.json()) as { id: number };
    expect(body.id).toBe(1001);
  });

  it('passes Redmine 422 through as 422 UPSTREAM_ERROR', async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if ((init?.method ?? 'GET') === 'POST' && url.endsWith('/issues.json')) {
        return new Response(
          JSON.stringify({ errors: ['Tracker is required'] }),
          { status: 422 },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof globalThis.fetch;

    const res = await makeWritableApp().request('/issues', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: 7, subject: 'New' }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('UPSTREAM_ERROR');
    expect(body.error.message).toContain('Tracker is required');
  });
});

describe('DELETE /issues/:id', () => {
  afterEach(() => {
    globalThis.fetch = REAL_FETCH;
  });

  it('deletes the issue and returns { id }', async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if ((init?.method ?? 'GET') === 'DELETE' && url.includes('/issues/1001.json')) {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof globalThis.fetch;

    const res = await makeWritableApp().request('/issues/1001', { method: 'DELETE' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: number };
    expect(body.id).toBe(1001);
    expect(calls.some((c) => c.startsWith('DELETE '))).toBe(true);
  });

  it('passes Redmine 404 through as 404 NOT_FOUND', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ errors: ['Not found'] }), { status: 404 });
    }) as unknown as typeof globalThis.fetch;

    const res = await makeWritableApp().request('/issues/9999', { method: 'DELETE' });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
