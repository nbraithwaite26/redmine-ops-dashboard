import { Hono } from 'hono';
import { redmineFetch } from '../redmineClient.js';
import { adaptTimeEntry } from '../adapters/timeEntry.js';
import { paginated, paginationSchema, passthroughQuery } from './_helpers.js';
import type { RedmineTimeEntryDto } from '../types/redmineDto.js';

const timeEntries = new Hono();

const LIST_FILTERS = [
  'user_id',
  'project_id',
  'issue_id',
  'activity_id',
  'from',
  'to',
  'spent_on',
] as const;

timeEntries.get('/', async (c) => {
  const q = paginationSchema.parse(c.req.query());
  const filters = passthroughQuery(
    c.req.query() as Record<string, string>,
    LIST_FILTERS,
  );

  const raw = await redmineFetch<{
    time_entries: RedmineTimeEntryDto[];
    total_count: number;
    limit: number;
    offset: number;
  }>('/time_entries.json', {
    query: { limit: q.limit, offset: q.offset, ...filters },
  });

  return c.json(
    paginated({
      items: raw.time_entries.map(adaptTimeEntry),
      totalCount: raw.total_count,
      limit: raw.limit,
      offset: raw.offset,
    }),
  );
});

export default timeEntries;
