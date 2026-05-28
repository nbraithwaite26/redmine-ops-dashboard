/**
 * Cache warmer (CR #29). On boot and on a recurring interval, fires a list
 * of "warm tasks" that pre-populate the server-side cache for the hot keys
 * users hit on first load.
 *
 * Each task gets a `request(path)` function that calls the app's own Hono
 * routes (same code path users hit), so the cache keys line up exactly.
 * Tasks are isolated: a failure in one doesn't kill the others.
 *
 * Backoff: if any task fails in a cycle, the next cycle is delayed by an
 * exponentially-growing pad (capped at 15 min). Resets on a clean cycle.
 */

export type WarmRequest = (path: string) => Promise<Response>;

export interface WarmTask {
  name: string;
  run: (request: WarmRequest) => Promise<void>;
}

const DEFAULT_INTERVAL_MS = 5 * 60_000;
const MAX_BACKOFF_MS = 15 * 60_000;
const BACKOFF_START_MS = 60_000;

const PAGE_CONCURRENCY = 4;

/**
 * Walks all pages of a paginated list endpoint (limit=100) in parallel.
 * Reads total_count from page 0 first, then fires the remaining offsets
 * with bounded concurrency so a single warm cycle finishes in
 * ~ceil(pages/4) upstream round-trips instead of `pages`.
 */
function withPagedQuery(basePath: string, offset: number): string {
  const sep = basePath.includes('?') ? '&' : '?';
  return `${basePath}${sep}limit=100&offset=${offset}`;
}

async function warmAllPages(
  request: WarmRequest,
  basePath: string,
  maxPages = 50,
): Promise<void> {
  const first = await request(withPagedQuery(basePath, 0));
  if (!first.ok) return;
  const body = (await first.json()) as { total?: number };
  const total = typeof body.total === 'number' ? body.total : 0;
  if (total <= 100) return;
  const pages = Math.min(maxPages, Math.ceil(total / 100));
  const offsets: number[] = [];
  for (let p = 1; p < pages; p += 1) offsets.push(p * 100);

  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = cursor;
      cursor += 1;
      if (i >= offsets.length) return;
      const offset = offsets[i] as number;
      await request(withPagedQuery(basePath, offset)).catch(() => undefined);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(PAGE_CONCURRENCY, offsets.length) }, () => worker()),
  );
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfThisWeekIso(): string {
  const today = new Date();
  const day = today.getDay(); // 0 = Sunday
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  return monday.toISOString().slice(0, 10);
}

/**
 * Mirrors the URL shapes the Dashboard hits on first load (see
 * src/services/realRedmineApi.ts). Dates are computed at warm time so they
 * stay current; the user id is read from /me and passed through verbatim
 * the same way useCurrentUser hydrates it on the frontend.
 *
 * Lists that can exceed 100 are walked via warmAllPages — the frontend
 * paginates all of them, so we have to warm every page they'll request.
 */
async function warmDashboardKeys(request: WarmRequest): Promise<void> {
  // Hit /me first to learn the current user id (same call the frontend
  // makes via useCurrentUser; serves cached after the first time).
  const meRes = await request('/api/redmine/me');
  if (!meRes.ok) return;
  const me = (await meRes.json()) as { id?: number };
  const userId = typeof me.id === 'number' ? me.id : null;

  const today = todayIso();
  const weekStart = startOfThisWeekIso();

  // High-volume lists: walk every page so a 3766-issue cold load doesn't
  // bite the first visitor. warmAllPages already uses bounded concurrency.
  const heavy: Promise<unknown>[] = [
    warmAllPages(request, '/api/redmine/issues'),
    warmAllPages(
      request,
      `/api/redmine/issues?due_date=%3C%3D${today}&status_id=open`,
    ),
    warmAllPages(
      request,
      `/api/redmine/time-entries?from=${weekStart}&to=${today}`,
    ),
  ];

  // Light/single-page keys.
  const light: Promise<unknown>[] = [request('/api/redmine/metadata').catch(() => undefined)];
  if (userId !== null) {
    light.push(
      warmAllPages(request, `/api/redmine/issues?assigned_to_id=${userId}`),
    );
    light.push(
      warmAllPages(
        request,
        `/api/redmine/time-entries?user_id=${userId}&from=${weekStart}&to=${today}`,
      ),
    );
  }

  await Promise.all([...heavy, ...light]);
}

export const DEFAULT_WARM_TASKS: WarmTask[] = [
  {
    name: 'gantt:project-127',
    run: async (request) => {
      await request('/api/redmine/gantt?project_id=127');
    },
  },
  {
    name: 'projects:list:all-pages',
    run: async (request) => {
      await warmAllPages(request, '/api/redmine/projects');
    },
  },
  {
    name: 'dashboard:hot-keys',
    run: warmDashboardKeys,
  },
];

export interface WarmerHandle {
  stop: () => void;
}

export interface StartWarmerOptions {
  request: WarmRequest;
  tasks?: WarmTask[];
  intervalMs?: number;
  onError?: (taskName: string, err: unknown) => void;
  runOnStart?: boolean;
}

export function startWarmer(opts: StartWarmerOptions): WarmerHandle {
  const tasks = opts.tasks ?? DEFAULT_WARM_TASKS;
  const interval = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  const runOnStart = opts.runOnStart ?? true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let backoffMs = 0;
  let stopped = false;

  const runAll = async (): Promise<void> => {
    const results = await Promise.allSettled(
      tasks.map((t) => t.run(opts.request)),
    );
    let hadFailure = false;
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const task = tasks[i];
        if (task) opts.onError?.(task.name, r.reason);
        hadFailure = true;
      }
    });
    backoffMs = hadFailure
      ? Math.min(MAX_BACKOFF_MS, backoffMs === 0 ? BACKOFF_START_MS : backoffMs * 2)
      : 0;
  };

  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      await runAll();
    } catch {
      // runAll already absorbs per-task errors; this guards against bugs
      // in runAll itself. Keep the loop alive.
    }
    if (!stopped) {
      timer = setTimeout(() => {
        void tick();
      }, interval + backoffMs);
    }
  };

  if (runOnStart) {
    void tick();
  } else {
    timer = setTimeout(() => {
      void tick();
    }, interval);
  }

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
