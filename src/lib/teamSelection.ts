import type { User } from '../types/redmine';

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

const STORAGE_KEY = 'rod.team.selectedUserIds';

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
 */
export function defaultSelectedUserIds(users: ReadonlyArray<User>): number[] {
  const wantedNames = new Set(DEFAULT_TEAM_FIRST_NAMES);
  const wantedLogins = new Set(DEFAULT_TEAM_LOGINS);
  const matched = users
    .filter((u) => wantedNames.has(firstName(u)) || wantedLogins.has(loginPart(u)))
    .map((u) => u.id);
  return matched.length > 0 ? matched : users.map((u) => u.id);
}

/** Read a persisted selection, or null if absent/invalid. */
export function loadSelection(): number[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((n) => typeof n === 'number')) {
      return parsed;
    }
  } catch {
    // ignore malformed storage
  }
  return null;
}

export function saveSelection(ids: number[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore quota / privacy-mode failures
  }
}
