import { Hono } from 'hono';
import { z } from 'zod';
import { readEvents } from '../../store/historyStore.js';

const adminHistory = new Hono();

const querySchema = z.object({
  kind: z.enum(['sync', 'login', 'all']).default('all'),
  status: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

adminHistory.get('/', async (c) => {
  const q = querySchema.parse(c.req.query());
  const result = await readEvents(q);
  return c.json(result);
});

export default adminHistory;
