import { Hono } from 'hono';
import { redmineFetch } from '../redmineClient.js';
import {
  adaptMemberships,
  adaptProjectDetail,
  adaptProjectSummary,
} from '../adapters/project.js';
import { keyFromParts } from '../cache.js';
import { paginated, paginationSchema } from './_helpers.js';
import type { RedmineMembershipDto, RedmineProjectDto } from '../types/redmineDto.js';

const projects = new Hono();

const LIST_TTL_MS = 60_000;
const LIST_STALE_MS = 10 * 60_000;
const DETAIL_TTL_MS = 60_000;

// LIST: no include= on purpose (plan §6 Notes — not verified on list endpoint).
// Each page is cached separately; the boot-time warmer (CR #29 commit 6)
// walks all pages so the browser's first hit is always a cache hit.
projects.get('/', async (c) => {
  const q = paginationSchema.parse(c.req.query());
  const raw = await redmineFetch<{
    projects: RedmineProjectDto[];
    total_count: number;
    limit: number;
    offset: number;
  }>('/projects.json', {
    query: { limit: q.limit, offset: q.offset },
    cache: {
      key: keyFromParts('projects:list', { limit: q.limit, offset: q.offset }),
      ttlMs: LIST_TTL_MS,
      staleMs: LIST_STALE_MS,
    },
  });

  return c.json(
    paginated({
      items: raw.projects.map(adaptProjectSummary),
      totalCount: raw.total_count,
      limit: raw.limit,
      offset: raw.offset,
    }),
  );
});

// DETAIL: include enabled_modules,trackers,issue_categories.
projects.get('/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'));
  const raw = await redmineFetch<{ project: RedmineProjectDto }>(`/projects/${id}.json`, {
    query: { include: 'enabled_modules,trackers,issue_categories' },
    cache: { key: keyFromParts('projects:detail', { id }), ttlMs: DETAIL_TTL_MS },
  });
  return c.json(adaptProjectDetail(raw.project));
});

// MEMBERS.
projects.get('/:id{[0-9]+}/members', async (c) => {
  const id = Number(c.req.param('id'));
  const q = paginationSchema.parse(c.req.query());
  const raw = await redmineFetch<{
    memberships: RedmineMembershipDto[];
    total_count: number;
    limit: number;
    offset: number;
  }>(`/projects/${id}/memberships.json`, {
    query: { limit: q.limit, offset: q.offset },
    cache: {
      key: keyFromParts('projects:members', { id, limit: q.limit, offset: q.offset }),
      ttlMs: LIST_TTL_MS,
      staleMs: LIST_STALE_MS,
    },
  });
  return c.json(
    paginated({
      items: adaptMemberships(raw.memberships),
      totalCount: raw.total_count,
      limit: raw.limit,
      offset: raw.offset,
    }),
  );
});

export default projects;
