import { spawnSync } from 'node:child_process';
import { platform } from 'node:os';

/**
 * CR #30 — start the portable .exe automatically on Windows sign-in.
 *
 * Mechanism: write the .exe path to
 *   HKCU\Software\Microsoft\Windows\CurrentVersion\Run\RedmineOpsDashboard
 *
 * That's the user-scoped autorun key — same one OneDrive / Slack / etc.
 * use. No admin elevation required. Removing the value disables it.
 *
 * Detection uses `reg query`; mutation uses `reg add` / `reg delete`.
 * Both ship with every Windows install since at least Vista. Non-Windows
 * platforms get a clean `supported: false` so the UI hides the toggle.
 */

const REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const REG_VALUE_NAME = 'RedmineOpsDashboard';

export interface AutostartStatus {
  /** True only on win32. */
  supported: boolean;
  /** Currently registered? */
  enabled: boolean;
  /** Path persisted in the registry (when enabled). */
  registeredPath?: string;
  /** Resolved path the current process is running from. */
  exePath: string;
}

export function isAutostartSupported(): boolean {
  return platform() === 'win32';
}

/** Best-guess of the .exe path. In dev (tsx) this is the Node binary,
 *  which is correct for the dev case but not useful for shipping — the
 *  caller should only invoke this from a compiled portable build. */
function resolveExePath(): string {
  return process.execPath;
}

export function getAutostartStatus(): AutostartStatus {
  const exePath = resolveExePath();
  if (!isAutostartSupported()) {
    return { supported: false, enabled: false, exePath };
  }
  const res = spawnSync('reg', ['query', REG_KEY, '/v', REG_VALUE_NAME], {
    encoding: 'utf8',
  });
  if (res.status !== 0) {
    return { supported: true, enabled: false, exePath };
  }
  // `reg query` output:
  //   HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run
  //       RedmineOpsDashboard    REG_SZ    "C:\path\to\app.exe"
  const match = res.stdout.match(/REG_SZ\s+(.+?)\s*$/m);
  const registeredPath = match?.[1]?.trim().replace(/^"|"$/g, '');
  return {
    supported: true,
    enabled: true,
    exePath,
    ...(registeredPath ? { registeredPath } : {}),
  };
}

/** Enable autostart by writing the current .exe path to the Run key. */
export function enableAutostart(): AutostartStatus {
  if (!isAutostartSupported()) {
    throw new Error('Autostart is only available on Windows.');
  }
  const exePath = resolveExePath();
  const res = spawnSync(
    'reg',
    ['add', REG_KEY, '/v', REG_VALUE_NAME, '/t', 'REG_SZ', '/d', exePath, '/f'],
    { encoding: 'utf8' },
  );
  if (res.status !== 0) {
    throw new Error(`reg add failed: ${res.stderr || res.stdout || `exit ${res.status}`}`);
  }
  return getAutostartStatus();
}

/** Disable autostart by removing the Run key value. */
export function disableAutostart(): AutostartStatus {
  if (!isAutostartSupported()) {
    throw new Error('Autostart is only available on Windows.');
  }
  spawnSync('reg', ['delete', REG_KEY, '/v', REG_VALUE_NAME, '/f'], {
    encoding: 'utf8',
  });
  // `reg delete` returns non-zero when the value wasn't present. That's
  // fine — caller wanted it gone, and now it is.
  return getAutostartStatus();
}
