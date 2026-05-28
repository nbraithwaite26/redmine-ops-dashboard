import { describe, expect, it, vi } from 'vitest';
import { startWarmer, type WarmTask } from '../src/warmer.js';

function okResponse(body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe('warmer', () => {
  it('runs every task on start', async () => {
    const calls: string[] = [];
    const tasks: WarmTask[] = [
      { name: 'a', run: async () => { calls.push('a'); } },
      { name: 'b', run: async () => { calls.push('b'); } },
    ];
    const handle = startWarmer({
      request: async () => okResponse(),
      tasks,
      intervalMs: 60_000,
    });
    // Yield so the initial runAll() completes
    await new Promise((r) => setImmediate(r));
    expect(calls.sort()).toEqual(['a', 'b']);
    handle.stop();
  });

  it('continues running surviving tasks if one rejects', async () => {
    const seen: string[] = [];
    const errors: Array<[string, unknown]> = [];
    const tasks: WarmTask[] = [
      { name: 'fail', run: async () => { throw new Error('boom'); } },
      { name: 'ok', run: async () => { seen.push('ok'); } },
    ];
    const handle = startWarmer({
      request: async () => okResponse(),
      tasks,
      intervalMs: 60_000,
      onError: (name, err) => errors.push([name, err]),
    });
    await new Promise((r) => setImmediate(r));
    expect(seen).toEqual(['ok']);
    expect(errors).toHaveLength(1);
    expect(errors[0]![0]).toBe('fail');
    handle.stop();
  });

  it('re-runs tasks on the configured interval', async () => {
    vi.useFakeTimers();
    try {
      let runs = 0;
      const tasks: WarmTask[] = [
        { name: 'tick', run: async () => { runs += 1; } },
      ];
      const handle = startWarmer({
        request: async () => okResponse(),
        tasks,
        intervalMs: 1000,
      });
      // Initial run uses `void tick()` (no timer) — drain microtasks.
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
      expect(runs).toBe(1);

      // Advance one interval — the queued setTimeout fires the second tick.
      await vi.advanceTimersByTimeAsync(1000);
      expect(runs).toBe(2);

      handle.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips the initial run when runOnStart is false', async () => {
    let runs = 0;
    const handle = startWarmer({
      request: async () => okResponse(),
      tasks: [{ name: 'k', run: async () => { runs += 1; } }],
      intervalMs: 60_000,
      runOnStart: false,
    });
    await new Promise((r) => setImmediate(r));
    expect(runs).toBe(0);
    handle.stop();
  });

  it('passes the request function to tasks', async () => {
    const seen: string[] = [];
    const request = vi.fn(async (path: string) => {
      seen.push(path);
      return okResponse();
    });
    const tasks: WarmTask[] = [
      {
        name: 'fetch',
        run: async (req) => {
          await req('/api/redmine/foo');
        },
      },
    ];
    const handle = startWarmer({ request, tasks, intervalMs: 60_000 });
    await new Promise((r) => setImmediate(r));
    expect(seen).toEqual(['/api/redmine/foo']);
    handle.stop();
  });
});
