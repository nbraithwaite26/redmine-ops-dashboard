import type { User } from '../types/redmine';
import type { Workspace } from '../hooks/useWorkspace';

/**
 * Engineers selected by default on the "Your Team's Work" tab. Matched by
 * first name (case-insensitive) against the derived roster, so this stays
 * data-driven — no hard-coded user IDs — and degrades gracefully when a name
 * isn't present in the live data.
 */
export const DEFAULT_TEAM_FIRST_NAMES = [
  'adrian',
  'nigel',
  'jose',
  'kevin',
  'richard',
  'victor',
];

/**
 * Live Redmine returns assignee names as email addresses (the non-admin key
 * can't read /users), so first-name matching never fires there. These are the
 * email local-parts of the default engineers on this instance, confirmed by
 * the user. The selector lets anyone change the set, and the choice persists.
 */
export const DEFAULT_TEAM_LOGINS = [
  'jgarcia',
  'dddeleon',
  'afreixas',
  'fketter',
  'agrasso',
  'kgonzalez',
  'nvillasenor',
  'nbraithwaite',
  'rdelgado',
  'vcrodrigues',
  'vcoy',
  'mhernandez',
];

// Keep a per-workspace key so each workspace remembers its own selection.
// The legacy key is read once for migration and then ignored.
const LEGACY_STORAGE_KEY = 'rod.team.selectedUserIds';
const STORAGE_KEY_BY_WORKSPACE: Record<Workspace, string> = {
  eng: 'rod.team.selectedUserIds.eng',
  ops: 'rod.team.selectedUserIds.ops',
};

/** Lower-cased first token of a user's display name. */
export function firstName(user: User): string {
  return user.name.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
}

/** Lower-cased email/login local-part (text before the @), if present. */
export function loginPart(user: User): string {
  const source = (user.email || user.login || user.name).trim().toLowerCase();
  return source.split('@')[0] ?? '';
}

/**
 * Default-selected user IDs: engineers whose first name is in
 * DEFAULT_TEAM_FIRST_NAMES (proper-name environments) or whose email
 * local-part is in DEFAULT_TEAM_LOGINS (live Redmine, where names are
 * emails). If none match, fall back to selecting everyone so the tab is never
 * empty on first load.
 *
 * Used as the LAST-RESORT default when no workspace-specific source is
 * available. Prefer `defaultSelectedForWorkspace` when you can.
 */
export function defaultSelectedUserIds(users: ReadonlyArray<User>): number[] {
  const wantedNames = new Set(DEFAULT_TEAM_FIRST_NAMES);
  const wantedLogins = new Set(DEFAULT_TEAM_LOGINS);
  const matched = users
    .filter((u) => wantedNames.has(firstName(u)) || wantedLogins.has(loginPart(u)))
    .map((u) => u.id);
  return matched.length > 0 ? matched : users.map((u) => u.id);
}

/**
 * Workspace-aware default selection.
 *
 *   - 'eng' workspace: intersect the visible roster with the `(eng) Aircraft`
 *     Redmine group (passed in via `aircraftGroupMemberIds`). Falls back to
 *     the legacy name/login default if the group lookup hasn't resolved or
 *     produced an empty intersection.
 *   - 'ops' workspace: every engineer in the roster — the broader
 *     operational view.
 */
export function defaultSelectedForWorkspace(
  workspace: Workspace,
  users: ReadonlyArray<User>,
  aircraftGroupMemberIds: ReadonlySet<number> | null,
): number[] {
  if (workspace === 'ops') {
    return users.map((u) => u.id);
  }
  // workspace === 'eng'
  if (aircraftGroupMemberIds && aircraftGroupMemberIds.size > 0) {
    const filtered = users
      .filter((u) => aircraftGroupMemberIds.has(u.id))
      .map((u) => u.id);
    if (filtered.length > 0) return filtered;
  }
  return defaultSelectedUserIds(users);
}

/**
 * Read a persisted selection for the given workspace, or null if absent /
 * invalid. Also migrates the legacy single-workspace key on first read.
 */
export function loadSelection(workspace: Workspace): number[] | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_BY_WORKSPACE[workspace]);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.every((n) => typeof n === 'number')) {
        return parsed;
      }
    }
    // One-time migration: pre-workspace builds saved under a single key.
    // We assume that selection was the user's 'eng' default and copy it
    // there; the legacy key is then removed so we don't re-migrate.
    if (workspace === 'eng') {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.every((n) => typeof n === 'number')) {
          localStorage.setItem(STORAGE_KEY_BY_WORKSPACE.eng, legacy);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          return parsed;
        }
      }
    }
  } catch {
    // ignore malformed storage
  }
  return null;
}

export function saveSelection(workspace: Workspace, ids: number[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_BY_WORKSPACE[workspace], JSON.stringify(ids));
  } catch {
    // ignore quota / privacy-mode failures
  }
}
