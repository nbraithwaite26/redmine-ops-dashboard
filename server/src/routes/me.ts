import { Hono } from 'hono';
import { redmineFetch } from '../redmineClient.js';
import { adaptUser } from '../adapters/user.js';
import type { RedmineUserDto } from '../types/redmineDto.js';

const me = new Hono();

me.get('/', async (c) => {
  const raw = await redmineFetch<{ user: RedmineUserDto }>('/users/current.json');
  return c.json(adaptUser(raw.user));
});

export default me;
