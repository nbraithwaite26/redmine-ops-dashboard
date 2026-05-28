import { Hono } from 'hono';
import { getCacheStats, invalidate } from '../cache.js';
import type { AppEnv } from '../types/appVars.js';

/**
 * Admin-gated cache control endpoints (CR #29).
 *
 *   POST /api/admin/_cache/invalidate           — clear everything
 *   POST /api/admin/_cache/invalidate?prefix=…  — clear matching prefix
 *   GET  /api/admin/_cache/stats                — hit/miss counters
 *
 * Mounted inside the admin group in index.ts, so requireSession() gates
 * both endpoints. Browsers wanting a force-refresh on a single read should
 * send Cache-Control: no-cache on the read itself (CR #29 commit 7).
 */
const _cache = new Hono<AppEnv>();

_cache.post('/invalidate', (c) => {
  const prefix = c.req.query('prefix');
  const removed = invalidate(prefix);
  return c.json({ removed });
});

_cache.get('/stats', (c) => c.json(getCacheStats()));

export default _cache;
