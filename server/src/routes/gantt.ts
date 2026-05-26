import { Hono } from 'hono';
import { redmineFetch } from '../redmineClient.js';
import { adaptIssue } from '../adapters/issue.js';
import { buildGanttRows } from '../adapters/gantt.js';
import { passthroughQuery } from './_helpers.js';
import type { RedmineIssueDto } from '../types/redmineDto.js';

const gantt = new Hono();

const FILTERS = ['project_id', 'assigned_to_id', 'status_id', 'tracker_id'] as const;

const PAGE = 100;
const MAX_PAGES = 10; // safety cap (≈1000 issues); a Gantt past that is unusable

/**
 * Returns Gantt rows derived server-side from issues + relations. The plan
 * (§7.5) calls for one normalized array per row, with isOverloaded and
 * isAtRisk pre-computed.
 *
 * Pages through all matching issues (Redmine caps limit at 100). When a
 * `project_id` filter is supplied, Redmine includes the project's subprojects,
 * so passing a parent project id scopes the Gantt to that whole tree.
 */
gantt.get('/', async (c) => {
  const filters = passthroughQuery(
    c.req.query() as Record<string, string>,
    FILTERS,
  );

  const collected: RedmineIssueDto[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const raw = await redmineFetch<{ issues: RedmineIssueDto[]; total_count: number }>(
      '/issues.json',
      {
        query: { limit: PAGE, offset: page * PAGE, include: 'relations', ...filters },
      },
    );
    collected.push(...raw.issues);
    if (raw.issues.length === 0 || collected.length >= raw.total_count) break;
  }

  const issues = collected.map(adaptIssue);
  const rows = buildGanttRows(issues);
  return c.json({ items: rows, total: rows.length });
});

export default gantt;
