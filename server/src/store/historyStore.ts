import { promises as fs } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { config } from '../config.js';

/**
 * Append-only JSONL history store. Per plan §14.3 v1.1: SQLite was the
 * original target, but JSONL avoids native-build risk on Windows and the
 * scale here (a few thousand events per kind) makes file-scan filtering
 * cheap. Promote to SQLite if/when scale demands it.
 *
 * Two event kinds: 'sync' and 'login'. Each line is a single JSON object.
 */

export type EventKind = 'sync' | 'login';

export interface SyncEvent {
  kind: 'sync';
  id: number; // monotonic per file load; not persisted
  at: string; // ISO8601
  actor: string;
  trigger: string;
  status: 'success' | 'error';
  durationMs?: number;
  errorMessage?: string;
  requestId: string;
}

export interface LoginEvent {
  kind: 'login';
  id: number;
  at: string;
  user: string; // attempted user (truncated to 64 chars)
  status: 'success' | 'failed' | 'rate_limited';
  sourceIp?: string;
  requestId: string;
}

export type HistoryEvent = SyncEvent | LoginEvent;

function resolveDbPath(): string {
  // HISTORY_DB defaults to ./server/data/history.jsonl from the plan §14.3.
  // When the server is started from repo root the relative path resolves
  // correctly. We accept absolute paths too.
  const raw = config.admin.historyDb;
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
}

async function ensureDir() {
  const path = resolveDbPath();
  await fs.mkdir(dirname(path), { recursive: true });
}

// Per-kind input types — TypeScript's distributive `Omit` does not preserve
// the discriminator narrowing on union members, so we spell each out and
// take the explicit union here.
export type AppendableEvent =
  | Omit<SyncEvent, 'id'>
  | Omit<LoginEvent, 'id'>;

export async function appendEvent(event: AppendableEvent) {
  await ensureDir();
  const path = resolveDbPath();
  await fs.appendFile(path, JSON.stringify(event) + '\n', 'utf8');
}

export interface ReadFilters {
  kind?: EventKind | 'all';
  since?: string;
  until?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ReadResult {
  items: HistoryEvent[];
  total: number;
  limit: number;
  offset: number;
}

export async function readEvents(filters: ReadFilters = {}): Promise<ReadResult> {
  const limit = Math.min(filters.limit ?? 100, 500);
  const offset = filters.offset ?? 0;

  let raw: string;
  try {
    raw = await fs.readFile(resolveDbPath(), 'utf8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { items: [], total: 0, limit, offset };
    }
    throw err;
  }

  const events: HistoryEvent[] = [];
  let nextId = 1;
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line) as Omit<HistoryEvent, 'id'>;
      events.push({ ...obj, id: nextId++ } as HistoryEvent);
    } catch {
      // skip malformed lines
    }
  }

  const filtered = events.filter((e) => {
    if (filters.kind && filters.kind !== 'all' && e.kind !== filters.kind) return false;
    if (filters.status && (e as { status: string }).status !== filters.status) return false;
    if (filters.since && e.at < filters.since) return false;
    if (filters.until && e.at > filters.until) return false;
    return true;
  });

  // Sort by `at` descending (newest first).
  filtered.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
    limit,
    offset,
  };
}
