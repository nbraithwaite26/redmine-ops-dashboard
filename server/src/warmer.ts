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

/**
 * Walks all pages of a paginated list endpoint (limit=100). Reads
 * total_count from page 0, then fires the remaining offsets in sequence
 * — sequential is fine because each call is cheap once the upstream is
 * also cached by Redmine itself, and bunching here keeps load smooth.
 */
async function warmAllPages(
  request: WarmRequest,
  basePath: string,
  maxPages = 20,
): Promise<void> {
  const first = await request(`${basePath}?limit=100&offset=0`);
  if (!first.ok) return;
  const body = (await first.json()) as { total?: number };
  const total = typeof body.total === 'number' ? body.total : 0;
  if (total <= 100) return;
  const pages = Math.min(maxPages, Math.ceil(total / 100));
  for (let p = 1; p < pages; p += 1) {
    const res = await request(`${basePath}?limit=100&offset=${p * 100}`);
    if (!res.ok) return; // bail on first failure; next cycle will retry
  }
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
