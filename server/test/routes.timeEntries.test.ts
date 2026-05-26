import { afterEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { requestId } from '../src/middleware/requestId.js';
import timeEntriesRoute from '../src/routes/timeEntries.js';

const REAL_FETCH = globalThis.fetch;

function makeApp() {
  const app = new Hono();
  app.use('*', requestId());
  app.route('/time-entries', timeEntriesRoute);
  return app;
}

const activitiesPayload = {
  time_entry_activities: [
    { id: 9, name: 'Development' },
    { id: 10, name: 'Meeting' },
  ],
};

const createdEntry = {
  time_entry: {
    id: 5050,
    project: { id: 7, name: 'Project A' },
    issue: { id: 1001 },
    user: { id: 42, name: 'Test User' },
    activity: { id: 9, name: 'Development' },
    hours: 2.5,
    comments: 'Anonymized test comment',
    spent_on: '2026-05-26',
    created_on: '2026-05-26T10:00:00Z',
    updated_on: '2026-05-26T10:00:00Z',
  },
};

describe('POST /time-entries', () => {
  afterEach(() => {
    globalThis.fetch = REAL_FETCH;
  });

  it('returns 400 when neither projectId nor issueId is provided', async () => {
    const res = await makeApp().request('/time-entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hours: 1, spentOn: '2026-05-26' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.message).toMatch(/projectId or issueId/);
  });

  it('returns 400 when hours is non-positive', async () => {
    const res = await makeApp().request('/time-entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hours: 0, spentOn: '2026-05-26', projectId: 7 }),
    });
    expect(res.status).toBe(400);
  });

  it('POSTs the camel→snake body and returns 201 with the created entry', async () => {
    const calls: Array<{ url: string; method: string; body: string | undefined }> = [];
    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? init.body : undefined;
      calls.push({ url, method, body });
      if (url.includes('/time_entry_activities.json')) {
        return new Response(JSON.stringify(activitiesPayload), { status: 200 });
      }
      if (method === 'POST' && url.endsWith('/time_entries.json')) {
        return new Response(JSON.stringify(createdEntry), { status: 201 });
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    }) as unknown as typeof globalThis.fetch;

    const res = await makeApp().request('/time-entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        hours: 2.5,
        spentOn: '2026-05-26',
        activity: 'Development',
        issueId: 1001,
        comments: 'Anonymized test comment',
      }),
    });
    expect(res.status).toBe(201);

    const postCall = calls.find((c) => c.method === 'POST')!;
    const sent = JSON.parse(postCall.body!) as { time_entry: Record<string, unknown> };
    expect(sent.time_entry.hours).toBe(2.5);
    expect(sent.time_entry.spent_on).toBe('2026-05-26');
    expect(sent.time_entry.activity_id).toBe(9);
    expect(sent.time_entry.issue_id).toBe(1001);
    expect(sent.time_entry.comments).toBe('Anonymized test comment');
    // camelCase keys must not leak
    expect(sent.time_entry.spentOn).toBeUndefined();
    expect(sent.time_entry.issueId).toBeUndefined();

    const body = (await res.json()) as { id: number; activity: string };
    expect(body.id).toBe(5050);
    expect(body.activity).toBe('Development');
  });
});

describe('PATCH /time-entries/:id', () => {
  afterEach(() => {
    globalThis.fetch = REAL_FETCH;
  });

  it('returns 400 when the body is empty', async () => {
    const res = await makeApp().request('/time-entries/5001', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('PUTs the patch and returns the refetched entry', async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'PUT' && url.includes('/time_entries/5001.json')) {
        return new Response(null, { status: 204 });
      }
      if (method === 'GET' && url.includes('/time_entries/5001.json')) {
        return new Response(
          JSON.stringify({ time_entry: { ...createdEntry.time_entry, id: 5001, hours: 3.0 } }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    }) as unknown as typeof globalThis.fetch;

    const res = await makeApp().request('/time-entries/5001', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hours: 3.0 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: number; hours: number };
    expect(body.id).toBe(5001);
    expect(body.hours).toBe(3.0);
  });

  it('passes Redmine 404 through as 404 NOT_FOUND', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ errors: ['Not found'] }), { status: 404 });
    }) as unknown as typeof globalThis.fetch;

    const res = await makeApp().request('/time-entries/9999', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hours: 1 }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 422 BAD_REQUEST for unknown activity name', async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/time_entry_activities.json')) {
        return new Response(JSON.stringify(activitiesPayload), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof globalThis.fetch;

    const res = await makeApp().request('/time-entries/5001', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activity: 'Definitely Not Real' }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.message).toMatch(/unknown activity/i);
  });
});

describe('DELETE /time-entries/:id', () => {
  afterEach(() => {
    globalThis.fetch = REAL_FETCH;
  });

  it('deletes the entry and returns { id }', async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if ((init?.method ?? 'GET') === 'DELETE' && url.includes('/time_entries/5001.json')) {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof globalThis.fetch;

    const res = await makeApp().request('/time-entries/5001', { method: 'DELETE' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: number };
    expect(body.id).toBe(5001);
  });

  it('passes Redmine 404 through as 404 NOT_FOUND', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ errors: ['Not found'] }), { status: 404 });
    }) as unknown as typeof globalThis.fetch;

    const res = await makeApp().request('/time-entries/9999', { method: 'DELETE' });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
