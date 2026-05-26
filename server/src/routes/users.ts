import { Hono } from 'hono';
import { redmineFetch } from '../redmineClient.js';
import { adaptUser } from '../adapters/user.js';
import { paginated, paginationSchema } from './_helpers.js';
import type { RedmineUserDto } from '../types/redmineDto.js';

const users = new Hono();

users.get('/', async (c) => {
  const q = paginationSchema.parse(c.req.query());
  const raw = await redmineFetch<{
    users: RedmineUserDto[];
    total_count: number;
    limit: number;
    offset: number;
  }>('/users.json', { query: { limit: q.limit, offset: q.offset } });

  return c.json(
    paginated({
      items: raw.users.map(adaptUser),
      totalCount: raw.total_count,
      limit: raw.limit,
      offset: raw.offset,
    }),
  );
});

export default users;
