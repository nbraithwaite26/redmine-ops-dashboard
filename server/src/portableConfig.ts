import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir, platform } from 'node:os';

/**
 * CR #30 — portable distribution.
 *
 * In portable mode the .exe doesn't ship with a Redmine API key. Instead,
 * the user logs in on first launch with their Redmine URL + username +
 * password; the server hits `/users/current.json` via Basic Auth and
 * persists the returned `api_key` on disk so subsequent launches don't
 * prompt again.
 *
 * Layout:
 *   Windows: %APPDATA%\redmine-ops-dashboard\config.json
 *   macOS:   ~/Library/Application Support/redmine-ops-dashboard/config.json
 *   Linux:   $XDG_CONFIG_HOME/redmine-ops-dashboard/config.json
 *            (falls back to ~/.config/redmine-ops-dashboard/config.json)
 *
 * This module is intentionally synchronous. Reads/writes happen on the
 * server process startup or on the auth route's single login call — not
 * in the hot path.
 */

export interface PortableConfigPayload {
  /** Normalized — trailing slash trimmed. */
  redmineBaseUrl: string;
  /** Redmine API key returned by /users/current.json. NOT the user's password. */
  redmineApiKey: string;
  /** Redmine login (for display purposes only). */
  login: string;
  /** ISO timestamp of the last successful login. */
  loggedInAt: string;
  /** Last port the .exe bound to. Used so subsequent launches re-use the
   *  same port whenever possible — makes the single-instance lock and
   *  browser bookmarks stable when the preferred port is contested. */
  lastPort?: number;
}

let cache: PortableConfigPayload | null | undefined; // undefined = not loaded yet

/** Compute the per-platform path to the portable config file. */
export function getPortableConfigPath(): string {
  const appName = 'redmine-ops-dashboard';
  // Allow tests / power users to override the resolved path entirely.
  if (process.env.PORTABLE_CONFIG_PATH) return process.env.PORTABLE_CONFIG_PATH;

  if (platform() === 'win32') {
    const appData = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming');
    return join(appData, appName, 'config.json');
  }
  if (platform() === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', appName, 'config.json');
  }
  const xdg = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
  return join(xdg, appName, 'config.json');
}

/** Read the persisted config from disk. Returns null when not configured. */
export function readPortableConfig(): PortableConfigPayload | null {
  if (cache !== undefined) return cache;
  const path = getPortableConfigPath();
  if (!existsSync(path)) {
    cache = null;
    return null;
  }
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PortableConfigPayload>;
    if (
      typeof parsed.redmineBaseUrl === 'string' &&
      typeof parsed.redmineApiKey === 'string' &&
      typeof parsed.login === 'string'
    ) {
      cache = {
        redmineBaseUrl: parsed.redmineBaseUrl.replace(/\/$/, ''),
        redmineApiKey: parsed.redmineApiKey,
        login: parsed.login,
        loggedInAt: parsed.loggedInAt ?? new Date(0).toISOString(),
        ...(typeof parsed.lastPort === 'number' ? { lastPort: parsed.lastPort } : {}),
      };
      return cache;
    }
    cache = null;
    return null;
  } catch {
    // Corrupted file — treat as unconfigured so the login flow runs again.
    cache = null;
    return null;
  }
}

/** Persist a new config payload. Creates the parent directory if needed. */
export function writePortableConfig(next: PortableConfigPayload): void {
  const path = getPortableConfigPath();
  mkdirSync(dirname(path), { recursive: true });
  const payload: PortableConfigPayload = {
    redmineBaseUrl: next.redmineBaseUrl.replace(/\/$/, ''),
    redmineApiKey: next.redmineApiKey,
    login: next.login,
    loggedInAt: next.loggedInAt,
    ...(next.lastPort !== undefined ? { lastPort: next.lastPort } : {}),
  };
  // 0600 — owner-only. Best-effort; on Windows fs perms are advisory.
  writeFileSync(path, JSON.stringify(payload, null, 2), { mode: 0o600 });
  cache = payload;
}

/** Forget the persisted config (logout). */
export function clearPortableConfig(): void {
  const path = getPortableConfigPath();
  if (existsSync(path)) {
    try {
      unlinkSync(path);
    } catch {
      // ignore — the file is the source of truth on next read
    }
  }
  cache = null;
}

/**
 * Reset the in-memory cache. Tests use this; runtime code shouldn't need
 * to (writePortableConfig / clearPortableConfig already refresh it).
 */
export function _resetPortableConfigCacheForTests(): void {
  cache = undefined;
}
