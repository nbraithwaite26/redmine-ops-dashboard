import { Hono } from 'hono';
import { z } from 'zod';
import { appendEvent } from '../store/historyStore.js';
import type { AppEnv } from '../types/appVars.js';

/**
 * POST /api/sync-events
 *
 * Records that a frontend-initiated sync ran. The actor is taken from the
 * session if present, otherwise 'anonymous'. Sits OUTSIDE /api/redmine so
 * it is not blocked by the read-only middleware.
 */
const syncEvents = new Hono<AppEnv>();

const bodySchema = z.object({
  trigger: z.string().min(1).max(64),
  status: z.enum(['success', 'error']),
  durationMs: z.number().int().nonnegative().optional(),
  errorMessage: z.string().max(256).optional(),
});

syncEvents.post('/', async (c) => {
  const requestId = c.get('requestId') as string;
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await c.req.json());
  } catch {
    return c.json(
      { error: { code: 'BAD_REQUEST', message: 'Invalid sync event payload.', requestId } },
      400,
    );
  }

  const actor = (c.get('sessionUser') as string | undefined) ?? 'anonymous';
  await appendEvent({
    kind: 'sync',
    at: new Date().toISOString(),
    actor,
    trigger: body.trigger,
    status: body.status,
    durationMs: body.durationMs,
    errorMessage: body.errorMessage,
    requestId,
  });

  return c.json({ ok: true });
});

export default syncEvents;
