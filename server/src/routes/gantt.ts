import { Hono } from 'hono';
import { redmineFetch } from '../redmineClient.js';
import { adaptIssue } from '../adapters/issue.js';
import { buildGanttRows } from '../adapters/gantt.js';
import { getOrFetch, keyFromParts } from '../cache.js';
import { passthroughQuery } from './_helpers.js';
import type { RedmineIssueDto } from '../types/redmineDto.js';

const gantt = new Hono();

const FILTERS = ['project_id', 'assigned_to_id', 'status_id', 'tracker_id'] as const;

const PAGE = 100;
const MAX_PAGES = 10; // safety cap (≈1000 issues); a Gantt past that is unusable
const CONCURRENCY = 4;

const TTL_MS = 60_000;
const STALE_MS = 5 * 60_000;

async function withConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = cursor;
      cursor += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i] as T, i);
    }
  }
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

async function fetchPage(
  offset: number,
  filters: Record<string, string>,
): Promise<{ issues: RedmineIssueDto[]; total_count: number }> {
  return redmineFetch<{ issues: RedmineIssueDto[]; total_count: number }>(
    '/issues.json',
    {
      query: { limit: PAGE, offset, include: 'relations', ...filters },
    },
  );
}

/**
 * Returns Gantt rows derived server-side from issues + relations. The plan
 * (§7.5) calls for one normalized array per row, with isOverloaded and
 * isAtRisk pre-computed.
 *
 * Page 0 is fetched first to learn `total_count`. Remaining pages are then
 * fetched **in parallel** with bounded concurrency, then derived rows are
 * cached under a per-filter-set key with SWR (CR #29).
 */
gantt.get('/', async (c) => {
  const filters = passthroughQuery(
    c.req.query() as Record<string, string>,
    FILTERS,
  );

  const payload = await getOrFetch(
    keyFromParts('gantt', filters),
    TTL_MS,
    async () => {
      const collected: RedmineIssueDto[] = [];

      const first = await fetchPage(0, filters);
      collected.push(...first.issues);

      if (first.issues.length > 0 && collected.length < first.total_count) {
        const totalPages = Math.min(
          MAX_PAGES,
          Math.ceil(first.total_count / PAGE),
        );
        const remainingOffsets: number[] = [];
        for (let p = 1; p < totalPages; p += 1) {
          remainingOffsets.push(p * PAGE);
        }
        const pages = await withConcurrency(
          remainingOffsets,
          CONCURRENCY,
          (offset) => fetchPage(offset, filters),
        );
        for (const page of pages) collected.push(...page.issues);
      }

      const issues = collected.map(adaptIssue);
      const rows = buildGanttRows(issues);
      return { items: rows, total: rows.length };
    },
    { staleMs: STALE_MS },
  );

  return c.json(payload);
});

export default gantt;
