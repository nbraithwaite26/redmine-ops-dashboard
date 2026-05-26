import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendEvent, readEvents } from '../src/store/historyStore.js';

// Mirror the historyStore's REPO_ROOT-anchored path resolution so the
// test clears the same file the production code writes. (Setup.ts sets
// HISTORY_DB='./server/test/.tmp-history.jsonl' which resolves against
// the repo root regardless of CWD.)
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HISTORY_PATH = resolve(REPO_ROOT, 'server/test/.tmp-history.jsonl');

async function clearHistory() {
  try {
    await fs.unlink(HISTORY_PATH);
  } catch {
    /* ignore */
  }
}

describe('history store', () => {
  beforeEach(clearHistory);
  afterEach(clearHistory);

  it('returns an empty list when the file does not exist', async () => {
    const res = await readEvents();
    expect(res.items).toEqual([]);
    expect(res.total).toBe(0);
  });

  it('appends and reads back events sorted newest-first', async () => {
    await appendEvent({
      kind: 'login',
      at: '2026-05-20T00:00:00Z',
      user: 'admin',
      status: 'success',
      requestId: 'req-1',
    });
    await appendEvent({
      kind: 'sync',
      at: '2026-05-21T00:00:00Z',
      actor: 'admin',
      trigger: 'topbar',
      status: 'success',
      requestId: 'req-2',
    });
    const res = await readEvents();
    expect(res.total).toBe(2);
    expect(res.items[0]?.kind).toBe('sync');
    expect(res.items[1]?.kind).toBe('login');
  });

  it('filters by kind', async () => {
    await appendEvent({
      kind: 'login',
      at: '2026-05-20T00:00:00Z',
      user: 'admin',
      status: 'success',
      requestId: 'req-1',
    });
    await appendEvent({
      kind: 'sync',
      at: '2026-05-21T00:00:00Z',
      actor: 'admin',
      trigger: 'topbar',
      status: 'success',
      requestId: 'req-2',
    });
    const onlyLogin = await readEvents({ kind: 'login' });
    expect(onlyLogin.total).toBe(1);
    expect(onlyLogin.items.every((e) => e.kind === 'login')).toBe(true);
  });

  it('paginates with limit + offset', async () => {
    for (let i = 0; i < 5; i++) {
      await appendEvent({
        kind: 'sync',
        at: `2026-05-2${i}T00:00:00Z`,
        actor: 'admin',
        trigger: 'topbar',
        status: 'success',
        requestId: `req-${i}`,
      });
    }
    const page = await readEvents({ limit: 2, offset: 1 });
    expect(page.total).toBe(5);
    expect(page.items.length).toBe(2);
  });
});
