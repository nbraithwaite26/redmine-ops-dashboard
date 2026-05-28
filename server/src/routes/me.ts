import { Hono } from 'hono';
import { redmineFetch } from '../redmineClient.js';
import { adaptUser } from '../adapters/user.js';
import type { RedmineUserDto } from '../types/redmineDto.js';

const me = new Hono();

const TTL_MS = 60_000;

me.get('/', async (c) => {
  const raw = await redmineFetch<{ user: RedmineUserDto }>('/users/current.json', {
    cache: { key: 'me:current', ttlMs: TTL_MS },
  });
  return c.json(adaptUser(raw.user));
});

export default me;
