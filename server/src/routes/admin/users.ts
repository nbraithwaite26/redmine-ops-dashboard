import { Hono } from 'hono';
import { redmineFetch, RedmineHttpError } from '../../redmineClient.js';
import { adaptUser } from '../../adapters/user.js';
import {
  paginated,
  paginationSchema,
} from '../_helpers.js';
import type { RedmineUserDto } from '../../types/redmineDto.js';

const adminUsers = new Hono();

/**
 * GET /api/admin/users
 *
 * Read-only Redmine user mirror. Admin-only. /users.json may 403 for
 * non-admin API keys — surface that as an empty list with a flag so the
 * UI can degrade.
 */
adminUsers.get('/', async (c) => {
  const q = paginationSchema.parse(c.req.query());
  try {
    const raw = await redmineFetch<{
      users: RedmineUserDto[];
      total_count: number;
      limit: number;
      offset: number;
    }>('/users.json', { query: { limit: q.limit, offset: q.offset } });

    return c.json({
      ...paginated({
        items: raw.users.map(adaptUser),
        totalCount: raw.total_count,
        limit: raw.limit,
        offset: raw.offset,
      }),
      degraded: false,
    });
  } catch (err) {
    if (err instanceof RedmineHttpError && (err.status === 401 || err.status === 403)) {
      return c.json({
        items: [],
        total: 0,
        limit: q.limit,
        offset: q.offset,
        degraded: true,
        degradedReason:
          'Redmine /users endpoint is admin-only and the configured API key is not an admin. Members are available per-project instead.',
      });
    }
    throw err;
  }
});

export default adminUsers;
