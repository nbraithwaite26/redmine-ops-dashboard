import { Hono } from 'hono';
import { redmineFetch, RedmineHttpError } from '../redmineClient.js';
import { adaptGroup } from '../adapters/group.js';
import { keyFromParts } from '../cache.js';
import type { RedmineGroupDto } from '../types/redmineDto.js';
import type { AppEnv } from '../types/appVars.js';

/**
 * Redmine user groups for the dashboard's team picker.
 *
 * Upstream gotcha: /groups.json (the admin "list all groups" endpoint)
 * 403s for non-admin API keys, so the LIST endpoint here returns a
 * hand-curated catalog of group IDs we've confirmed exist on this
 * instance. The DETAIL endpoint (/groups/:id.json?include=users) IS
 * readable by non-admin keys — that's where the actual member list comes
 * from.
 *
 * If the upstream group catalog grows or shrinks, update KNOWN_GROUPS.
 * Discovery path: walk /projects/:id/memberships.json across a handful
 * of engineering projects; every `group` ref that appears is a candidate.
 */

const groups = new Hono<AppEnv>();

const DETAIL_TTL_MS = 10 * 60_000; // 10 min — group membership is stable.

/**
 * Catalog of team groups. Tier 0 = primary engineering teams (engineering
 * disciplines); Tier 1 = broader Avionica teams. Lower tier sorts first.
 */
const KNOWN_GROUPS: { id: number; name: string; tier: number }[] = [
  // Engineering disciplines
  { id: 122, name: '(eng) Aircraft', tier: 0 },
  { id: 233, name: '(eng) Mgt', tier: 0 },
  { id: 114, name: '(eng) Hardware', tier: 0 },
  { id: 112, name: '(eng) Software', tier: 0 },
  { id: 133, name: '(eng) Tech Pubs', tier: 0 },
  { id: 496, name: '(eng) NextNet', tier: 0 },
  { id: 685, name: '(eng) R&D', tier: 0 },
  // Broader Avionica
  { id: 935, name: '(avi) ENG Exec', tier: 1 },
  { id: 212, name: '(avi) FDS', tier: 1 },
  { id: 936, name: '(avi) avSYNC', tier: 1 },
  { id: 136, name: '(avi) Prod', tier: 1 },
  { id: 185, name: '(avi) QA', tier: 1 },
  { id: 140, name: '(avi) Sales', tier: 1 },
  { id: 197, name: '(avi) Support', tier: 1 },
];

groups.get('/', (c) => {
  // Stable order: tier then name.
  const items = [...KNOWN_GROUPS]
    .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name))
    .map(({ id, name }) => ({ id, name }));
  return c.json({ items });
});

groups.get('/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'));
  const requestId = c.get('requestId');
  try {
    const raw = await redmineFetch<{ group: RedmineGroupDto }>(
      `/groups/${id}.json`,
      {
        query: { include: 'users' },
        cache: {
          key: keyFromParts('groups:detail', { id }),
          ttlMs: DETAIL_TTL_MS,
        },
      },
    );
    return c.json(adaptGroup(raw.group));
  } catch (err) {
    if (err instanceof RedmineHttpError && err.status === 404) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: `Group ${id} not found.`, requestId } },
        404,
      );
    }
    if (err instanceof RedmineHttpError && err.status === 403) {
      return c.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'API key cannot read this group. Most groups are non-admin-readable; check the group ID.',
            requestId,
          },
        },
        403,
      );
    }
    throw err;
  }
});

export default groups;
