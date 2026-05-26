import { Hono } from 'hono';
import { redmineFetch } from '../redmineClient.js';
import { adaptIssue } from '../adapters/issue.js';
import { paginated, paginationSchema, passthroughQuery } from './_helpers.js';
import type { RedmineIssueDto } from '../types/redmineDto.js';

const issues = new Hono();

const LIST_FILTERS = [
  'assigned_to_id',
  'author_id',
  'project_id',
  'tracker_id',
  'status_id',
  'priority_id',
  'subproject_id',
  'due_date',
  'start_date',
  'created_on',
  'updated_on',
  'sort',
  'query',
] as const;

issues.get('/', async (c) => {
  const q = paginationSchema.parse(c.req.query());
  const filters = passthroughQuery(
    c.req.query() as Record<string, string>,
    LIST_FILTERS,
  );

  const raw = await redmineFetch<{
    issues: RedmineIssueDto[];
    total_count: number;
    limit: number;
    offset: number;
  }>('/issues.json', {
    query: { limit: q.limit, offset: q.offset, ...filters },
  });

  return c.json(
    paginated({
      items: raw.issues.map(adaptIssue),
      totalCount: raw.total_count,
      limit: raw.limit,
      offset: raw.offset,
    }),
  );
});

issues.get('/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'));
  const raw = await redmineFetch<{ issue: RedmineIssueDto }>(`/issues/${id}.json`, {
    query: { include: 'children,relations,journals,attachments' },
  });
  return c.json(adaptIssue(raw.issue));
});

export default issues;
