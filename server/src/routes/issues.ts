import { Hono } from 'hono';
import { z } from 'zod';
import { redmineFetch, RedmineHttpError } from '../redmineClient.js';
import { adaptIssue } from '../adapters/issue.js';
import { paginated, paginationSchema, passthroughQuery } from './_helpers.js';
import type {
  RedmineEnumerationDto,
  RedmineIssueDto,
} from '../types/redmineDto.js';
import type { AppEnv } from '../types/appVars.js';

const issues = new Hono<AppEnv>();

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

// ─── PATCH /issues/:id ────────────────────────────────────────────────────
//
// Plan §9 Step 10: the first real write route. Accepts a curated patch in
// camelCase, maps to Redmine's snake_case body shape, PUTs, then re-fetches
// the issue and returns it (Redmine's own PUT returns 204).
//
// Status, priority, and tracker are sent by NAME from the UI; we resolve
// them to IDs by looking up the relevant enumeration. assignedTo is sent
// as a numeric user id (or `null` to unassign).

const patchBodySchema = z
  .object({
    subject: z.string().min(1).max(255).optional(),
    description: z.string().max(65_535).optional(),
    status: z.string().min(1).max(64).optional(),
    priority: z.string().min(1).max(64).optional(),
    tracker: z.string().min(1).max(64).optional(),
    assignedToId: z.number().int().positive().nullable().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    estimatedHours: z.number().nonnegative().nullable().optional(),
    doneRatio: z.number().int().min(0).max(100).optional(),
    parentIssueId: z.number().int().positive().nullable().optional(),
    notes: z.string().max(65_535).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Patch body must contain at least one editable field.',
  });

type PatchBody = z.infer<typeof patchBodySchema>;

// Small TTL cache for enumeration name→id maps. Plan §13 swaps this for a
// shared store; for now process-local is fine.
const ENUM_TTL_MS = 5 * 60 * 1000;
interface EnumCache { fetchedAt: number; map: Map<string, number> }
const enumCache = new Map<string, EnumCache>();

async function loadEnum(
  endpoint: string,
  collection: keyof { issue_statuses: never; issue_priorities: never; trackers: never },
): Promise<Map<string, number>> {
  const cached = enumCache.get(endpoint);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < ENUM_TTL_MS) return cached.map;
  const raw = await redmineFetch<Record<string, RedmineEnumerationDto[]>>(endpoint);
  const list = raw[collection as string] ?? [];
  const map = new Map<string, number>();
  for (const item of list) map.set(item.name.toLowerCase(), item.id);
  enumCache.set(endpoint, { fetchedAt: now, map });
  return map;
}

class PatchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PatchValidationError';
  }
}

async function camelPatchToRedmineBody(patch: PatchBody): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {};
  if (patch.subject !== undefined) body.subject = patch.subject;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.assignedToId !== undefined) body.assigned_to_id = patch.assignedToId;
  if (patch.startDate !== undefined) body.start_date = patch.startDate;
  if (patch.dueDate !== undefined) body.due_date = patch.dueDate;
  if (patch.estimatedHours !== undefined) body.estimated_hours = patch.estimatedHours;
  if (patch.doneRatio !== undefined) body.done_ratio = patch.doneRatio;
  if (patch.parentIssueId !== undefined) body.parent_issue_id = patch.parentIssueId;
  if (patch.notes !== undefined) body.notes = patch.notes;

  if (patch.status !== undefined) {
    const map = await loadEnum('/issue_statuses.json', 'issue_statuses');
    const id = map.get(patch.status.toLowerCase());
    if (id === undefined) {
      throw new PatchValidationError(`Unknown status: "${patch.status}"`);
    }
    body.status_id = id;
  }
  if (patch.priority !== undefined) {
    const map = await loadEnum('/enumerations/issue_priorities.json', 'issue_priorities');
    const id = map.get(patch.priority.toLowerCase());
    if (id === undefined) {
      throw new PatchValidationError(`Unknown priority: "${patch.priority}"`);
    }
    body.priority_id = id;
  }
  if (patch.tracker !== undefined) {
    const map = await loadEnum('/trackers.json', 'trackers');
    const id = map.get(patch.tracker.toLowerCase());
    if (id === undefined) {
      throw new PatchValidationError(`Unknown tracker: "${patch.tracker}"`);
    }
    body.tracker_id = id;
  }
  return body;
}

// ─── POST /issues ─────────────────────────────────────────────────────────
//
// Create a new issue. Same zod allowlist as PATCH plus projectId (required)
// — the other required fields (subject, tracker, ...) bubble up as Redmine
// validation errors that pass through as UPSTREAM_ERROR.

const createBodySchema = z
  .object({
    projectId: z.number().int().positive(),
    subject: z.string().min(1).max(255),
    description: z.string().max(65_535).optional(),
    status: z.string().min(1).max(64).optional(),
    priority: z.string().min(1).max(64).optional(),
    tracker: z.string().min(1).max(64).optional(),
    assignedToId: z.number().int().positive().nullable().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    estimatedHours: z.number().nonnegative().nullable().optional(),
    doneRatio: z.number().int().min(0).max(100).optional(),
    parentIssueId: z.number().int().positive().nullable().optional(),
  })
  .strict();

type CreateBody = z.infer<typeof createBodySchema>;

async function camelCreateToRedmineBody(input: CreateBody): Promise<Record<string, unknown>> {
  // Re-uses the same enum lookups + camel→snake mapping as PATCH; treats
  // projectId + subject as required fields.
  const patchShape = await camelPatchToRedmineBody({
    subject: input.subject,
    description: input.description,
    status: input.status,
    priority: input.priority,
    tracker: input.tracker,
    assignedToId: input.assignedToId,
    startDate: input.startDate,
    dueDate: input.dueDate,
    estimatedHours: input.estimatedHours,
    doneRatio: input.doneRatio,
    parentIssueId: input.parentIssueId,
  });
  return { project_id: input.projectId, ...patchShape };
}

issues.post('/', async (c) => {
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
    redmineBody = await camelCreateToRedmineBody(parsed);
  } catch (err) {
    if (err instanceof PatchValidationError) {
      return c.json(
        { error: { code: 'BAD_REQUEST', message: err.message, requestId } },
        422,
      );
    }
    throw err;
  }

  let created: { issue: RedmineIssueDto };
  try {
    created = await redmineFetch<{ issue: RedmineIssueDto }>('/issues.json', {
      method: 'POST',
      body: { issue: redmineBody },
    });
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

  return c.json(adaptIssue(created.issue), 201);
});

// ─── DELETE /issues/:id ───────────────────────────────────────────────────

issues.delete('/:id{[0-9]+}', async (c) => {
  const id = Number(c.req.param('id'));
  const requestId = c.get('requestId');

  try {
    await redmineFetch<void>(`/issues/${id}.json`, { method: 'DELETE' });
  } catch (err) {
    if (err instanceof RedmineHttpError && err.status === 404) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: `Issue ${id} not found.`, requestId } },
        404,
      );
    }
    throw err;
  }

  return c.json({ id });
});

issues.patch('/:id{[0-9]+}', async (c) => {
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
          message: err instanceof z.ZodError ? err.issues[0]?.message ?? 'Invalid patch body.' : 'Invalid patch body.',
          requestId,
        },
      },
      400,
    );
  }

  let redmineBody: Record<string, unknown>;
  try {
    redmineBody = await camelPatchToRedmineBody(parsed);
  } catch (err) {
    if (err instanceof PatchValidationError) {
      return c.json(
        { error: { code: 'BAD_REQUEST', message: err.message, requestId } },
        422,
      );
    }
    throw err;
  }

  try {
    await redmineFetch<void>(`/issues/${id}.json`, {
      method: 'PUT',
      body: { issue: redmineBody },
    });
  } catch (err) {
    if (err instanceof RedmineHttpError && err.status === 404) {
      return c.json(
        { error: { code: 'NOT_FOUND', message: `Issue ${id} not found.`, requestId } },
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

  // Re-fetch so the response carries the canonical updated issue, including
  // computed fields (closed_on if status flipped to a closed one, etc.).
  const fresh = await redmineFetch<{ issue: RedmineIssueDto }>(`/issues/${id}.json`, {
    query: { include: 'children,relations,journals,attachments' },
  });
  return c.json(adaptIssue(fresh.issue));
});

export default issues;
