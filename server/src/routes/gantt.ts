import { Hono } from 'hono';
import { redmineFetch } from '../redmineClient.js';
import { adaptIssue } from '../adapters/issue.js';
import { buildGanttRows } from '../adapters/gantt.js';
import { passthroughQuery } from './_helpers.js';
import type { RedmineIssueDto } from '../types/redmineDto.js';

const gantt = new Hono();

const FILTERS = ['project_id', 'assigned_to_id', 'status_id', 'tracker_id'] as const;

/**
 * Returns Gantt rows derived server-side from issues + relations. The plan
 * (§7.5) calls for one normalized array per row, with isOverloaded and
 * isAtRisk pre-computed.
 */
gantt.get('/', async (c) => {
  const filters = passthroughQuery(
    c.req.query() as Record<string, string>,
    FILTERS,
  );

  const raw = await redmineFetch<{ issues: RedmineIssueDto[] }>('/issues.json', {
    query: { limit: 100, include: 'relations', ...filters },
  });

  const issues = raw.issues.map(adaptIssue);
  const rows = buildGanttRows(issues);
  return c.json({ items: rows, total: rows.length });
});

export default gantt;
