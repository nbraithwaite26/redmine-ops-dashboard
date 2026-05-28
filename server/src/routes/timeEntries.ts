import { Hono } from 'hono';
import { z } from 'zod';
import { redmineFetch, RedmineHttpError } from '../redmineClient.js';
import { adaptTimeEntry } from '../adapters/timeEntry.js';
import { invalidate, keyFromParts } from '../cache.js';
import { paginated, paginationSchema, passthroughQuery } from './_helpers.js';
import type {
  RedmineEnumerationDto,
  RedmineTimeEntryDto,
} from '../types/redmineDto.js';
import type { AppEnv } from '../types/appVars.js';

const timeEntries = new Hono<AppEnv>();

const LIST_TTL_MS = 60_000;

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
    cache: {
      key: keyFromParts('time-entries:list', {
        limit: q.limit,
        offset: q.offset,
        ...filters,
      }),
      ttlMs: LIST_TTL_MS,
    },
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

// ─── Write routes (plan §9 Step 10 / fan-out) ─────────────────────────────
//
// Bodies arrive camelCased, with `activity` sent by NAME (Issue/TimeEntry
// types use strings for human readability). The backend resolves activity
// names to IDs via /enumerations/time_entry_activities.json and forwards
// the snake_case body to Redmine's REST endpoints.
//
// Same shape as the issues PATCH route — see server/src/routes/issues.ts
// for the rationale on the enum cache + camel→snake mapping.

const baseFieldsSchema = z.object({
  hours: z.number().positive().max(24 * 365),
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activity: z.string().min(1).max(64).optional(),
  comments: z.string().max(255).optional(),
  issueId: z.number().int().positive().nullable().optional(),
  projectId: z.number().int().positive().optional(),
});

const createBodySchema = baseFieldsSchema.extend({
  // Redmine requires EITHER project_id OR issue_id on create. The handler
  // checks the union; both schemas individually pass.
}).strict().refine((v) => v.projectId !== undefined || (v.issueId !== undefined && v.issueId !== null), {
  message: 'createTimeEntry requires projectId or issueId.',
});

const patchBodySchema = baseFieldsSchema
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Patch body must contain at least one editable field.',
  });

type CreateBody = z.infer<typeof createBodySchema>;
type PatchBody = z.infer<typeof patchBodySchema>;

// Activity name → ID cache. 5-min TTL; identical pattern to issues route.
const ACTIVITY_TTL_MS = 5 * 60 * 1000;
let activityCache: { fetchedAt: number; map: Map<string, number> } | null = null;

async function loadActivityMap(): Promise<Map<string, number>> {
  const now = Date.now();
  if (activityCache && now - activityCache.fetchedAt < ACTIVITY_TTL_MS) {
    return activityCache.map;
  }
  const raw = await redmineFetch<{
    time_entry_activities: RedmineEnumerationDto[];
  }>('/enumerations/time_entry_activities.json');
  const map = new Map<string, number>();
  for (const item of raw.time_entry_activities ?? []) {
    map.set(item.name.toLowerCase(), item.id);
  }
  activityCache = { fetchedAt: now, map };
  return map;
}

class TimeEntryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeEntryValidationError';
  }
}

async function toRedmineTimeEntryBody(input: PatchBody): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {};
  if (input.hours !== undefined) body.hours = input.hours;
  if (input.spentOn !== undefined) body.spent_on = input.spentOn;
  if (input.comments !== undefined) body.comments = input.comments;
  if (input.issueId !== undefined) body.issue_id = input.issueId;
  if (input.projectId !== undefined) body.project_id = input.projectId;
  if (input.activity !== undefined) {
    const map = await loadActivityMap();
    const id = map.get(input.activity.toLowerCase());
    if (id === undefined) {
      throw new TimeEntryValidationError(`Unknown activity: "${input.activity}"`);
    }
    body.activity_id = id;
  }
  return body;
}

// POST /time-entries

timeEntries.post('/', async (c) => {
  const requestId = c.get('requestId');

  let parsed: CreateBody;
  try {
    parsed = createBodySchema.parse(await c.req.json());
  } catch (err) {
    return c.json(
      {
        error: {
          code: 'BAD_REQUEST',
          message:
            err instanceof z.ZodError
              ? err.issues[0]?.message ?? 'Invalid create body.'
              : 'Invalid create body.',
          requestId,
        },
      },
      400,
    );
  }

  let redmineBody: Record<string, unknown>;
  try {
    redmineBody = await toRedmineTimeEntryBody(parsed);
  } catch (err) {
    if (err instanceof TimeEntryValidationError) {
      return c.json(
        { error: { code: 'BAD_REQUEST', message: err.message, requestId } },
        422,
      );
    }
    throw err;
  }

  let created: { time_entry: RedmineTimeEntryDto };
  try {
    created = await redmineFetch<{ time_entry: RedmineTimeEntryDto }>(
      '/time_entries.json',
      { method: 'POST', body: { time_entry: redmineBody } },
    );
  } catch (err) {
    if (err instanceof RedmineHttpError && err.status === 422) {
      return c.json(
        {
          error: {
            code: 'UPSTREAM_ERROR',
            message: err.redmineMessage ?? 'Redmine rejected the create.',
            requestId,
          },
        },
        422,
      );
    }
    throw err;
  }

  invalidate('time-entries:');
  return c.json(adaptTimeEntry(created.time_entry), 201);
});

// PATCH /time-entries/:id

timeEntries.patch('/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'));
  const requestId = c.get('requestId');

  let parsed: PatchBody;
  try {
    parsed = patchBodySchema.parse(await c.req.json());
  } catch (err) {
    return c.json(
      {
        error: {
          code: 'BAD_REQUEST',
          message:
            err instanceof z.ZodError
              ? err.issues[0]?.message ?? 'Invalid patch body.'
              : 'Invalid patch body.',
          requestId,
        },
      },
      400,
    );
  }

  let redmineBody: Record<string, unknown>;
  try {
    redmineBody = await toRedmineTimeEntryBody(parsed);
  } catch (err) {
    if (err instanceof TimeEntryValidationError) {
      return c.json(
        { error: { code: 'BAD_REQUEST', message: err.message, requestId } },
        422,
      );
    }
    throw err;
  }

  try {
    await redmineFetch<void>(`/time_entries/${id}.json`, {
      method: 'PUT',
      body: { time_entry: redmineBody },
    });
  } catch (err) {
    if (err instanceof RedmineHttpError && err.status === 404) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: `Time entry ${id} not found.`, requestId } },
        404,
      );
    }
    if (err instanceof RedmineHttpError && err.status === 422) {
      return c.json(
        {
          error: {
            code: 'UPSTREAM_ERROR',
            message: err.redmineMessage ?? 'Redmine rejected the patch.',
            requestId,
          },
        },
        422,
      );
    }
    throw err;
  }

  invalidate('time-entries:');
  const fresh = await redmineFetch<{ time_entry: RedmineTimeEntryDto }>(
    `/time_entries/${id}.json`,
  );
  return c.json(adaptTimeEntry(fresh.time_entry));
});

// DELETE /time-entries/:id

timeEntries.delete('/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'));
  const requestId = c.get('requestId');

  try {
    await redmineFetch<void>(`/time_entries/${id}.json`, { method: 'DELETE' });
  } catch (err) {
    if (err instanceof RedmineHttpError && err.status === 404) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: `Time entry ${id} not found.`, requestId } },
        404,
      );
    }
    throw err;
  }

  invalidate('time-entries:');
  return c.json({ id });
});

export default timeEntries;
