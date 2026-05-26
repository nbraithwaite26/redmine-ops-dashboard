import { Hono } from 'hono';
import { z } from 'zod';
import { redmineFetch } from '../redmineClient.js';
import {
  adaptMemberships,
  adaptProjectDetail,
  adaptProjectSummary,
} from '../adapters/project.js';
import { paginated, paginationSchema } from './_helpers.js';
import type { RedmineMembershipDto, RedmineProjectDto } from '../types/redmineDto.js';

const projects = new Hono();

// LIST: no include= on purpose (plan §6 Notes — not verified on list endpoint).
projects.get('/', async (c) => {
  const q = paginationSchema.parse(c.req.query());
  const raw = await redmineFetch<{
    projects: RedmineProjectDto[];
    total_count: number;
    limit: number;
    offset: number;
  }>('/projects.json', { query: { limit: q.limit, offset: q.offset } });

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
