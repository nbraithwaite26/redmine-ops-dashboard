import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, resolve as resolvePath } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { readPortableConfig, writePortableConfig } from './portableConfig.js';
import { installPortableDiagnostics, portableLog } from './portableLogger.js';
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
import timeOffRoute from './routes/timeOff.js';
import groupsRoute from './routes/groups.js';
import metadataRoute from './routes/metadata.js';
import ganttRoute from './routes/gantt.js';
import authRoute from './routes/auth.js';
import portableAuthRoute from './routes/portableAuth.js';
import syncEventsRoute from './routes/syncEvents.js';
import adminUsersRoute from './routes/admin/users.js';
import adminPermissionsRoute from './routes/admin/permissions.js';
import adminHistoryRoute from './routes/admin/history.js';
import cacheRoute from './routes/_cache.js';
import { session, requireSession } from './middleware/session.js';
import { startWarmer } from './warmer.js';
import { configureCache, getCacheStats } from './cache.js';

// Apply env-driven cache limits before anything else can touch the cache.
configureCache({
  maxEntries: config.cache.maxEntries,
  maxBytesPerEntry: config.cache.maxBytesPerEntry,
});

/**
 * App version. Portable .exe reads from a `package.json` written next
 * to the binary by `scripts/build-portable.mjs`. Dev falls back to the
 * repo root's `package.json` (CWD). Surfaced through
 * `/api/redmine/health` so the SPA can show a version chip and
 * teammates can confirm which build they're on.
 */
const APP_VERSION: string = (() => {
  const candidates = [
    resolvePath(dirname(process.execPath), 'package.json'),
    resolvePath(process.cwd(), 'package.json'),
  ];
  for (const path of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(path, 'utf8')) as { version?: string };
      if (typeof pkg.version === 'string' && pkg.version.length > 0) return pkg.version;
    } catch {
      // try next
    }
  }
  return '0.0.0-dev';
})();

// In portable mode the .exe runs hidden. Install crash guards + a
// rotating runtime.log next to the binary so we have a trace whenever
// it "dies randomly". Must run BEFORE any code that could throw async.
if (config.portable) {
  installPortableDiagnostics(APP_VERSION);
}

/**
 * Open `url` in the user's default browser. Best-effort — failures are
 * logged but don't crash the server. Called only in portable mode after
 * the .exe successfully binds its port.
 */
function openDefaultBrowser(url: string): void {
  try {
    const platform = process.platform;
    if (platform === 'win32') {
      // `start` is a cmd builtin. The empty "" placeholder is the window
      // title — required when the URL is passed quoted as a separate arg.
      spawn('cmd', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch (err) {
    console.warn(`[server] could not open browser at ${url}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * True when nothing is bound to `port` locally. Used by the portable
 * startup walk to find a free port without crashing the process if the
 * preferred one is contested by another app on the user's machine.
 */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port, '127.0.0.1');
  });
}

/**
 * Pick a free TCP port for the portable .exe. Order of preference:
 *   1. The port persisted in portableConfig from the last successful
 *      launch — keeps the URL stable across runs so bookmarks work.
 *   2. The configured preferred port (defaults to 8787).
 *   3. The next 20 ports above the preferred one.
 *   4. Whatever the OS hands us (port 0 → ephemeral).
 */
async function pickPortablePort(preferred: number, lastPort: number | undefined): Promise<number> {
  if (lastPort && lastPort !== preferred && (await isPortFree(lastPort))) return lastPort;
  if (await isPortFree(preferred)) return preferred;
  for (let p = preferred + 1; p <= preferred + 20; p++) {
    if (await isPortFree(p)) return p;
  }
  return 0;
}

/**
 * Detect whether another portable instance is already running on
 * `port`. Returns true (and opens the browser at it) when one is found.
 * Returns false when the port is free or hosts something else.
 */
async function detectExistingPortableInstance(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${port}/api/redmine/health`, {
      signal: AbortSignal.timeout(1000),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { portable?: boolean };
    if (body.portable) {
      const url = `http://localhost:${port}/`;
      console.log(`[server] another portable instance is already running on ${url} — opening browser there.`);
      openDefaultBrowser(url);
      return true;
    }
  } catch {
    // Port is free or busy with an unrelated service — proceed normally.
  }
  return false;
}

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
// Session/admin stack only runs in centralized mode. CR #30 portable
// .exes are single-user — they authenticate once via the portable login
// route and have no concept of an admin separate from the runtime user.
if (!config.portable) {
  app.use('*', session());
}

app.onError((err, c) => {
  if (config.portable) {
    portableLog(
      'route-error',
      c.req.method,
      c.req.path,
      err instanceof Error ? err : String(err),
    );
  }
  return respondWithError(c, err);
});

app.get('/health', (c) =>
  c.json({
    ok: true,
    mode: config.readOnly ? 'read-only' : 'read-write',
    portable: config.portable,
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
    portable: config.portable,
    version: APP_VERSION,
    requestId: c.get('requestId'),
  }),
);

api.route('/me', meRoute);
api.route('/users', usersRoute);
api.route('/groups', groupsRoute);
api.route('/projects', projectsRoute);
api.route('/issues', issuesRoute);
api.route('/time-entries', timeEntriesRoute);
api.route('/time-off', timeOffRoute);
api.route('/metadata', metadataRoute);
api.route('/gantt', ganttRoute);

app.route('/api/redmine', api);

// Auth + admin routes live OUTSIDE /api/redmine so the read-only middleware
// does not block POST /login or POST /logout.
if (config.portable) {
  // Single-user mode: only the portable login flow exists. No admin
  // surface, no session-gated routes, no audit history dependency.
  app.route('/api/portable', portableAuthRoute);
} else {
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
}

// CR #30 — portable .exe ships the SPA bundle next to the binary in
// `dist/`. Serve it as static assets so the user can open the dashboard
// in any browser at http://localhost:PORT/. Centralized topology keeps
// using Vite (dev) / a separate CDN (prod) — skip the static handler
// there entirely.
if (config.portable) {
  // The Bun-compiled .exe lives next to `dist/`. `process.execPath` is
  // the actual binary location — `import.meta.url` would point at Bun's
  // virtual `B:\~BUN\...` filesystem and we'd never find the bundle.
  // In dev (Node) execPath is the Node binary — there's no sibling
  // dist; existsSync just returns false and we log a warning. Fine.
  const exeDir = dirname(process.execPath);
  const distRoot = resolvePath(exeDir, 'dist');
  if (existsSync(distRoot)) {
    // serveStatic resolves paths relative to CWD, not __dirname. Pin
    // CWD to the .exe folder so the relative `./dist` lookup lands.
    process.chdir(exeDir);
    app.get('/*', serveStatic({ root: './dist' }));
    // Root: index.html. (Our SPA uses hash routing so no client-side
    // history fallback is needed.)
    app.get('/', async (c) => {
      const html = readFileSync(resolvePath(distRoot, 'index.html'), 'utf8');
      return c.html(html);
    });
  } else {
    console.warn(
      `[server] portable mode but no SPA bundle at ${distRoot} ` +
        `— only the API will be served.`,
    );
  }
}

// Resolve the portable .exe's port. The remembered port (if any)
// wins, so a teammate who bookmarked http://localhost:8788/ last time
// gets the same URL today even if 8787 is free now. If that port is
// already serving a portable instance, exit silently after opening the
// browser at it.
let resolvedPort = config.port;
let storedConfig = config.portable ? readPortableConfig() : null;
if (config.portable) {
  if (await detectExistingPortableInstance(storedConfig?.lastPort ?? config.port)) {
    process.exit(0);
  }
  resolvedPort = await pickPortablePort(config.port, storedConfig?.lastPort);
  if (resolvedPort === 0) {
    console.warn(
      `[server] no preferred port available; letting the OS pick an ephemeral one.`,
    );
  }
}

serve({ fetch: app.fetch, port: resolvedPort }, (info) => {
  console.log(
    `[server] listening on http://localhost:${info.port} ` +
      `(read-only=${config.readOnly}, origin=${config.allowedOrigin})`,
  );
  if (config.portable) {
    portableLog(`listening port=${info.port} readOnly=${config.readOnly}`);
    // Persist the actual bound port so the next launch can re-use it.
    if (storedConfig && storedConfig.lastPort !== info.port) {
      writePortableConfig({ ...storedConfig, lastPort: info.port });
    }
    openDefaultBrowser(`http://localhost:${info.port}/`);
  }
  if (config.cache.warmEnabled) {
    startWarmer({
      request: async (path) => {
        // Portable .exe boots before the user has logged in. Skip warming
        // when we don't yet have credentials so the log isn't full of
        // PortableNotConfigured errors. Once the user logs in, the next
        // tick (every 5 min by default) self-recovers.
        if (config.portable && !readPortableConfig()) {
          // The warmer parses JSON for some tasks — return an empty
          // object so it short-circuits cleanly until login.
          return new Response('{}', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return app.fetch(
          new Request(`http://localhost:${info.port}${path}`, {
            // Bypass the rate limiter so the warmer doesn't eat the
            // user's per-IP quota during paginated walks.
            headers: { 'x-internal-warmer': '1' },
          }),
        );
      },
      intervalMs: config.cache.warmIntervalMs,
      onError: (taskName, err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[warmer] ${taskName} failed: ${msg}`);
        if (config.portable) portableLog(`warmer ${taskName} failed: ${msg}`);
      },
    });
    console.log(
      `[warmer] enabled (interval ${config.cache.warmIntervalMs}ms)`,
    );
  }
  console.log(
    `[cache] limits maxEntries=${config.cache.maxEntries} ` +
      `maxBytesPerEntry=${config.cache.maxBytesPerEntry}`,
  );
  // Periodically surface rejected-too-large so operators can spot scoped
  // responses bouncing off the per-entry size guard. Only logs when the
  // counter has changed since the last tick to avoid noise.
  let lastRejected = 0;
  setInterval(() => {
    const s = getCacheStats();
    if (s.rejectedTooLarge !== lastRejected) {
      console.warn(
        `[cache] rejected-too-large counter: ${s.rejectedTooLarge} ` +
          `(consider raising CACHE_MAX_BYTES_PER_ENTRY)`,
      );
      lastRejected = s.rejectedTooLarge;
    }
  }, 5 * 60_000).unref?.();
});

export type AppType = typeof app;
