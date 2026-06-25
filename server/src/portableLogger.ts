import {
  appendFileSync,
  existsSync,
  renameSync,
  statSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Lightweight rotating log for the portable .exe.
 *
 * The .exe is compiled with `--windows-hide-console`, so stdout/stderr
 * don't show anywhere. When the process crashes or hangs, we want a
 * file the user can read (or send back) to know what happened.
 *
 * Layout:
 *   <exeDir>/runtime.log      ← current
 *   <exeDir>/runtime.log.old  ← previous when current exceeds 5 MB
 *
 * All writes are best-effort and swallow their own errors. Nothing this
 * module does is allowed to break the running server.
 */

const LOG_MAX_BYTES = 5_000_000;

function logPath(): string {
  return resolve(dirname(process.execPath), 'runtime.log');
}

function rotateIfBig(path: string): void {
  try {
    const size = statSync(path).size;
    if (size > LOG_MAX_BYTES) {
      const archive = path + '.old';
      try {
        // Overwrite any prior .old so the rotation is idempotent.
        if (existsSync(archive)) renameSync(archive, archive + '.tmp');
      } catch {
        /* ignore */
      }
      renameSync(path, archive);
    }
  } catch {
    // file might not exist yet; nothing to rotate
  }
}

/** Append a single timestamped line. Never throws. */
export function portableLog(...parts: unknown[]): void {
  try {
    const path = logPath();
    const now = new Date().toISOString();
    const text = parts
      .map((p) =>
        p instanceof Error
          ? p.stack ?? `${p.name}: ${p.message}`
          : typeof p === 'string'
            ? p
            : JSON.stringify(p),
      )
      .join(' ');
    appendFileSync(path, `[${now}] ${text}\n`);
    rotateIfBig(path);
  } catch {
    // best-effort — file system might be unavailable
  }
}

/**
 * Install process-level crash guards + a heartbeat. Returns the
 * heartbeat timer so callers can stop it if they ever need to (we
 * don't — it's `.unref()`'d so it doesn't keep the loop alive).
 *
 * The uncaughtException and unhandledRejection handlers log and
 * CONTINUE, which is the right default for Bun (which crashes on
 * these by default, unlike Node).
 */
export function installPortableDiagnostics(version: string): void {
  portableLog(`startup version=${version} pid=${process.pid} platform=${process.platform}`);
  portableLog(`execPath=${process.execPath}`);
  portableLog(`cwd=${process.cwd()}`);

  process.on('uncaughtException', (err) => {
    portableLog('uncaughtException:', err);
  });
  process.on('unhandledRejection', (reason) => {
    portableLog(
      'unhandledRejection:',
      reason instanceof Error ? reason : String(reason),
    );
  });
  process.on('exit', (code) => {
    portableLog(`exit code=${code}`);
  });
  // Signals — log so a user-triggered or external kill is visible.
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'] as const) {
    try {
      process.on(sig as NodeJS.Signals, () => {
        portableLog(`signal=${sig}`);
      });
    } catch {
      // some signals aren't supported on all platforms
    }
  }

  const heartbeat = setInterval(() => {
    const mem = process.memoryUsage();
    portableLog(
      `heartbeat rss=${(mem.rss / 1_000_000).toFixed(1)}M heap=${(mem.heapUsed / 1_000_000).toFixed(1)}M`,
    );
  }, 60_000);
  heartbeat.unref?.();
}
