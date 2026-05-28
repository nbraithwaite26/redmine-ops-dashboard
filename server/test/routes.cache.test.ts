import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { requestId } from '../src/middleware/requestId.js';
import { readOnly } from '../src/middleware/readOnly.js';
import issuesRoute from '../src/routes/issues.js';
import projectsRoute from '../src/routes/projects.js';
import metadataRoute from '../src/routes/metadata.js';
import timeEntriesRoute from '../src/routes/timeEntries.js';
import usersRoute from '../src/routes/users.js';
import meRoute from '../src/routes/me.js';
import ganttRoute from '../src/routes/gantt.js';
import issueFixture from './fixtures/issue.detail.json' with { type: 'json' };

const REAL_FETCH = globalThis.fetch;

function makeApp(opts: { writable?: boolean } = {}) {
  const app = new Hono();
  app.use('*', requestId());
  if (!opts.writable) app.use('*', readOnly());
  app.route('/issues', issuesRoute);
  app.route('/projects', projectsRoute);
  app.route('/metadata', metadataRoute);
  app.route('/time-entries', timeEntriesRoute);
  app.route('/users', usersRoute);
  app.route('/me', meRoute);
  app.route('/gantt', ganttRoute);
  return app;
}

interface MockState {
  fetchMock: ReturnType<typeof vi.fn>;
}

function installMock(handler: (url: string, init?: RequestInit) => Promise<Response>): MockState {
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) =>
    handler(String(input), init),
  );
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  return { fetchMock };
}

afterEach(() => {
  globalThis.fetch = REAL_FETCH;
});

describe('GET caching (CR #29) — second hit is a cache hit', () => {
  it('caches /issues list', async () => {
    const { fetchMock } = installMock(async () =>
      new Response(
        JSON.stringify({ issues: [], total_count: 0, limit: 100, offset: 0 }),
        { status: 200 },
      ),
    );
    await makeApp().request('/issues?project_id=127');
    await makeApp().request('/issues?project_id=127');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches /issues/:id detail', async () => {
    const { fetchMock } = installMock(async () =>
      new Response(JSON.stringify(issueFixture), { status: 200 }),
    );
    await makeApp().request('/issues/1001');
    await makeApp().request('/issues/1001');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches /projects list', async () => {
    const { fetchMock } = installMock(async () =>
      new Response(
        JSON.stringify({ projects: [], total_count: 0, limit: 100, offset: 0 }),
        { status: 200 },
      ),
    );
    await makeApp().request('/projects');
    await makeApp().request('/projects');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches /metadata bundle (single hit for 5 upstream calls)', async () => {
    const { fetchMock } = installMock(async (url) => {
      if (url.includes('issue_statuses')) {
        return new Response(JSON.stringify({ issue_statuses: [{ id: 1, name: 'New' }] }), {
          status: 200,
        });
      }
      if (url.includes('trackers')) {
        return new Response(JSON.stringify({ trackers: [{ id: 1, name: 'Task' }] }), {
          status: 200,
        });
      }
      if (url.includes('issue_priorities')) {
        return new Response(
          JSON.stringify({ issue_priorities: [{ id: 6, name: 'Normal' }] }),
          { status: 200 },
        );
      }
      if (url.includes('time_entry_activities')) {
        return new Response(
          JSON.stringify({ time_entry_activities: [{ id: 8, name: 'Design' }] }),
          { status: 200 },
        );
      }
      if (url.includes('issues.json')) {
        return new Response(JSON.stringify({ issues: [] }), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await makeApp().request('/metadata');
    const after1 = fetchMock.mock.calls.length;
    expect(after1).toBe(5); // four enums + sample issues
    await makeApp().request('/metadata');
    expect(fetchMock).toHaveBeenCalledTimes(after1); // entire bundle served from cache
  });

  it('caches /time-entries list', async () => {
    const { fetchMock } = installMock(async () =>
      new Response(
        JSON.stringify({ time_entries: [], total_count: 0, limit: 100, offset: 0 }),
        { status: 200 },
      ),
    );
    await makeApp().request('/time-entries?user_id=5');
    await makeApp().request('/time-entries?user_id=5');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches /users list', async () => {
    const { fetchMock } = installMock(async () =>
      new Response(
        JSON.stringify({ users: [], total_count: 0, limit: 100, offset: 0 }),
        { status: 200 },
      ),
    );
    await makeApp().request('/users');
    await makeApp().request('/users');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches /me', async () => {
    const { fetchMock } = installMock(async () =>
      new Response(
        JSON.stringify({ user: { id: 1, firstname: 'A', lastname: 'B', login: 'a' } }),
        { status: 200 },
      ),
    );
    await makeApp().request('/me');
    await makeApp().request('/me');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('Write invalidation (CR #29)', () => {
  it('PATCH /issues/:id clears issues:* and gantt:* caches', async () => {
    const calls: Array<{ method: string; url: string }> = [];
    installMock(async (url, init) => {
      const method = init?.method ?? 'GET';
      calls.push({ method, url });
      if (url.includes('/issues/1001.json') && method === 'PUT') {
        return new Response(null, { status: 204 });
      }
      if (url.includes('/issues/1001.json') && method === 'GET') {
        return new Response(JSON.stringify(issueFixture), { status: 200 });
      }
      if (url.includes('/issues.json') && method === 'GET') {
        return new Response(
          JSON.stringify({ issues: [], total_count: 0, limit: 100, offset: 0 }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    const app = makeApp({ writable: true });

    // Seed both list and detail caches.
    await app.request('/issues/1001');
    await app.request('/issues?project_id=127');
    const seedCount = calls.length;
    expect(seedCount).toBe(2);

    // Cached read — no new upstream
    await app.request('/issues/1001');
    expect(calls.length).toBe(seedCount);

    // Write — invalidates issues:*
    const patchRes = await app.request('/issues/1001', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: 'Updated' }),
    });
    expect(patchRes.status).toBe(200);

    // Next GET goes back to upstream (post-PATCH refetch already happened,
    // populating the cache fresh; that's one new fetch). The list endpoint
    // must also re-fetch because the prefix was invalidated.
    const beforeList = calls.length;
    await app.request('/issues?project_id=127');
    expect(calls.length).toBe(beforeList + 1);
  });

  it('PATCH /issues/:id also invalidates gantt:* (gantt re-fetches after a write)', async () => {
    let issuesCalls = 0;
    installMock(async (url, init) => {
      const method = init?.method ?? 'GET';
      if (url.includes('/issues/1001.json') && method === 'PUT') {
        return new Response(null, { status: 204 });
      }
      if (url.includes('/issues/1001.json') && method === 'GET') {
        return new Response(JSON.stringify(issueFixture), { status: 200 });
      }
      if (url.includes('/issues.json') && method === 'GET') {
        issuesCalls += 1;
        return new Response(
          JSON.stringify({ issues: [], total_count: 0, limit: 100, offset: 0 }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    const app = makeApp({ writable: true });

    await app.request('/gantt?project_id=127');
    const cold = issuesCalls;
    expect(cold).toBeGreaterThan(0);

    // Cached
    await app.request('/gantt?project_id=127');
    expect(issuesCalls).toBe(cold);

    // Write invalidates gantt:*
    await app.request('/issues/1001', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: 'Updated' }),
    });

    // Next gantt call must go upstream again
    await app.request('/gantt?project_id=127');
    expect(issuesCalls).toBeGreaterThan(cold);
  });

  it('POST /time-entries clears time-entries:* cache', async () => {
    let listCalls = 0;
    installMock(async (url, init) => {
      const method = init?.method ?? 'GET';
      if (url.includes('/time_entries.json') && method === 'GET') {
        listCalls += 1;
        return new Response(
          JSON.stringify({ time_entries: [], total_count: 0, limit: 100, offset: 0 }),
          { status: 200 },
        );
      }
      if (url.includes('/time_entries.json') && method === 'POST') {
        return new Response(
          JSON.stringify({
            time_entry: {
              id: 1,
              project: { id: 1, name: 'P' },
              user: { id: 5, name: 'U' },
              hours: 1,
              spent_on: '2026-05-28',
              activity: { id: 8, name: 'Design' },
              comments: '',
              created_on: '2026-05-28',
              updated_on: '2026-05-28',
            },
          }),
          { status: 201 },
        );
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    const app = makeApp({ writable: true });

    await app.request('/time-entries?user_id=5');
    const before = listCalls;
    await app.request('/time-entries?user_id=5');
    expect(listCalls).toBe(before); // cached

    await app.request('/time-entries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hours: 1, spentOn: '2026-05-28', projectId: 1 }),
    });

    await app.request('/time-entries?user_id=5');
    expect(listCalls).toBeGreaterThan(before); // re-fetched after write
  });
});
