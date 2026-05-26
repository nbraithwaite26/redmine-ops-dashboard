import { Hono } from 'hono';
import { redmineFetch, RedmineHttpError } from '../../redmineClient.js';
import type {
  RedmineMembershipDto,
  RedmineProjectDto,
} from '../../types/redmineDto.js';

const adminPermissions = new Hono();

/**
 * GET /api/admin/permissions?limit=N&offset=M
 *
 * Per plan §14.1: project × user × role matrix aggregated from each
 * project's memberships. The matrix is computed from the projects the
 * configured API key can see; admin-only Redmine endpoints aren't used.
 *
 * Output:
 *   {
 *     projects: [{ id, name }],
 *     rows: [{ userId, userName, byProjectRoles: { [projectId]: string[] } }],
 *     total: number,
 *   }
 */
adminPermissions.get('/', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100);
  const offset = Math.max(Number(c.req.query('offset') ?? 0), 0);

  const projectsResp = await redmineFetch<{
    projects: RedmineProjectDto[];
    total_count: number;
  }>('/projects.json', { query: { limit, offset } });

  const projectRefs = projectsResp.projects.map((p) => ({ id: p.id, name: p.name }));

  type Aggregate = {
    userId: number;
    userName: string;
    byProjectRoles: Record<number, string[]>;
  };
  const byUser = new Map<number, Aggregate>();

  // Fetch memberships per project in parallel. Some projects may 403 (the
  // API key lacks visibility) — swallow those individually rather than
  // failing the whole request.
  await Promise.all(
    projectRefs.map(async (p) => {
      try {
        const m = await redmineFetch<{ memberships: RedmineMembershipDto[] }>(
          `/projects/${p.id}/memberships.json`,
          { query: { limit: 100 } },
        );
        for (const row of m.memberships) {
          const principal = row.user ?? row.group;
          if (!principal) continue;
          const agg =
            byUser.get(principal.id) ??
            {
              userId: principal.id,
              userName: principal.name,
              byProjectRoles: {},
            };
          const existing = agg.byProjectRoles[p.id] ?? [];
          for (const r of row.roles) {
            if (!existing.includes(r.name)) existing.push(r.name);
          }
          agg.byProjectRoles[p.id] = existing;
          byUser.set(principal.id, agg);
        }
      } catch (err) {
        if (
          err instanceof RedmineHttpError &&
          (err.status === 401 || err.status === 403)
        ) {
          return;
        }
        throw err;
      }
    }),
  );

  return c.json({
    projects: projectRefs,
    rows: Array.from(byUser.values()).sort((a, b) =>
      a.userName.localeCompare(b.userName),
    ),
    total: projectsResp.total_count,
    limit,
    offset,
  });
});

export default adminPermissions;
