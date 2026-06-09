import { afterEach, describe, expect, it } from 'vitest';
import {
  defaultSelectedForWorkspace,
  defaultSelectedUserIds,
  firstName,
  loadSelection,
  saveSelection,
} from '../lib/teamSelection';
import type { User } from '../types/redmine';

function user(id: number, name: string): User {
  return { id, name, email: '', login: '', status: 'Active', groups: [], roles: [] };
}

const roster = [
  user(1, 'Nigel Braithwaite'),
  user(2, 'Jose Garcia'),
  user(3, 'Kevin Riegle'),
  user(4, 'Mara Goldstein'),
  user(5, 'Adrian Grasso'),
];

describe('firstName', () => {
  it('lower-cases the first token of the display name', () => {
    expect(firstName(user(1, 'Nigel Braithwaite'))).toBe('nigel');
    expect(firstName(user(2, '  Jose   Garcia '))).toBe('jose');
  });
});

describe('defaultSelectedUserIds', () => {
  it('selects engineers whose first name is in the default set', () => {
    // Nigel, Jose, Kevin, Adrian match; Mara does not.
    expect(defaultSelectedUserIds(roster).sort()).toEqual([1, 2, 3, 5]);
  });

  it('falls back to everyone when no name matches', () => {
    const noMatch = [user(10, 'Zelda Fitz'), user(11, 'Quinn Lee')];
    expect(defaultSelectedUserIds(noMatch)).toEqual([10, 11]);
  });

  it('matches live email-style names by their local-part login', () => {
    // Live Redmine surfaces names as emails; the default set maps to logins.
    const live = [
      user(20, 'nbraithwaite@avionica.com'),
      user(21, 'jgarcia@avionica.com'),
      user(22, 'afreixas@avionica.com'),
      user(23, 'unrelated@avionica.com'),
    ];
    expect(defaultSelectedUserIds(live).sort()).toEqual([20, 21, 22]);
  });
});

describe('defaultSelectedForWorkspace', () => {
  it('eng: intersects the roster with the aircraft-group member set', () => {
    const groupIds = new Set([1, 2, 4]); // Nigel, Jose, Mara
    expect(
      defaultSelectedForWorkspace('eng', roster, groupIds).sort(),
    ).toEqual([1, 2, 4]);
  });

  it('eng: falls back to the legacy name default when no group is available', () => {
    expect(
      defaultSelectedForWorkspace('eng', roster, null).sort(),
    ).toEqual(defaultSelectedUserIds(roster).sort());
  });

  it('eng: falls back to the legacy name default when the group intersection is empty', () => {
    const groupIds = new Set<number>([999, 1000]); // none in roster
    expect(
      defaultSelectedForWorkspace('eng', roster, groupIds).sort(),
    ).toEqual(defaultSelectedUserIds(roster).sort());
  });

  it('ops: selects EVERY engineer in the roster regardless of group', () => {
    const groupIds = new Set([1]); // shouldn't matter for ops
    expect(
      defaultSelectedForWorkspace('ops', roster, groupIds).sort(),
    ).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('selection persistence (per-workspace)', () => {
  afterEach(() => localStorage.clear());

  it('round-trips a selection through localStorage for a workspace', () => {
    saveSelection('eng', [3, 7, 9]);
    expect(loadSelection('eng')).toEqual([3, 7, 9]);
  });

  it('keeps each workspace selection independent', () => {
    saveSelection('eng', [1, 2, 3]);
    saveSelection('ops', [4, 5, 6]);
    expect(loadSelection('eng')).toEqual([1, 2, 3]);
    expect(loadSelection('ops')).toEqual([4, 5, 6]);
  });

  it('returns null when nothing is stored', () => {
    expect(loadSelection('eng')).toBeNull();
    expect(loadSelection('ops')).toBeNull();
  });

  it('returns null for malformed storage', () => {
    localStorage.setItem('rod.team.selectedUserIds.eng', '{not json');
    expect(loadSelection('eng')).toBeNull();
  });

  it("migrates the pre-workspace 'rod.team.selectedUserIds' key into the 'eng' slot on first read", () => {
    localStorage.setItem('rod.team.selectedUserIds', JSON.stringify([10, 20]));
    expect(loadSelection('eng')).toEqual([10, 20]);
    // Migration is one-shot — legacy key gone, eng key now holds the data.
    expect(localStorage.getItem('rod.team.selectedUserIds')).toBeNull();
    expect(loadSelection('eng')).toEqual([10, 20]);
  });
});
