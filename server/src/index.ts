import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { config } from './config.js';
import { respondWithError } from './middleware/errorHandler.js';
import { rateLimit } from './middleware/rateLimit.js';
import { readOnly } from './middleware/readOnly.js';
import { requestId } from './middleware/requestId.js';
import meRoute from './routes/me.js';
import usersRoute from './routes/users.js';
import projectsRoute from './routes/projects.js';
import issuesRoute from './routes/issues.js';
import timeEntriesRoute from './routes/timeEntries.js';
import metadataRoute from './routes/metadata.js';
import ganttRoute from './routes/gantt.js';
import authRoute from './routes/auth.js';
import syncEventsRoute from './routes/syncEvents.js';
import adminUsersRoute from './routes/admin/users.js';
import adminPermissionsRoute from './routes/admin/permissions.js';
import adminHistoryRoute from './routes/admin/history.js';
import cacheRoute from './routes/_cache.js';
import { session, requireSession } from './middleware/session.js';
import { startWarmer } from './warmer.js';

type Variables = {
  requestId: string;
  sessionUser?: string;
};

const app = new Hono<{ Variables: Variables }>();

app.use('*', requestId());
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: config.allowedOrigin,
    credentials: true,
  }),
);
app.use('*', rateLimit());
app.use('*', session());

app.onError((err, c) => respondWithError(c, err));

app.get('/health', (c) =>
  c.json({
    ok: true,
    mode: config.readOnly ? 'read-only' : 'read-write',
    requestId: c.get('requestId'),
  }),
);

// /api/redmine/* group — routes attach here in Section 6.
const api = new Hono<{ Variables: Variables }>();
api.use('*', readOnly());
api.get('/health', (c) =>
  c.json({
    ok: true,
    readOnly: config.readOnly,
    requestId: c.get('requestId'),
  }),
);

api.route('/me', meRoute);
api.route('/users', usersRoute);
api.route('/projects', projectsRoute);
api.route('/issues', issuesRoute);
api.route('/time-entries', timeEntriesRoute);
api.route('/metadata', metadataRoute);
api.route('/gantt', ganttRoute);

app.route('/api/redmine', api);

// Auth + admin routes live OUTSIDE /api/redmine so the read-only middleware
// does not block POST /login or POST /logout.
app.route('/api/auth', authRoute);
app.route('/api/sync-events', syncEventsRoute);

const admin = new Hono<{ Variables: Variables }>();
admin.use('*', requireSession());
admin.route('/users', adminUsersRoute);
admin.route('/permissions', adminPermissionsRoute);
admin.route('/history', adminHistoryRoute);
// Cache control (CR #29). Admin-gated — only an authenticated admin session
// can clear or inspect the server-side cache. Lives under /api/admin so the
// readOnly middleware on /api/redmine doesn't block the POST.
admin.route('/_cache', cacheRoute);
app.route('/api/admin', admin);

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(
    `[server] listening on http://localhost:${info.port} ` +
      `(read-only=${config.readOnly}, origin=${config.allowedOrigin})`,
  );
  if (config.cache.warmEnabled) {
    startWarmer({
      request: async (path) =>
        app.fetch(
          new Request(`http://localhost:${info.port}${path}`, {
            // Bypass the rate limiter so the warmer doesn't eat the
            // user's per-IP quota during paginated walks.
            headers: { 'x-internal-warmer': '1' },
          }),
        ),
      intervalMs: config.cache.warmIntervalMs,
      onError: (taskName, err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[warmer] ${taskName} failed: ${msg}`);
      },
    });
    console.log(
      `[warmer] enabled (interval ${config.cache.warmIntervalMs}ms)`,
    );
  }
});

export type AppType = typeof app;
