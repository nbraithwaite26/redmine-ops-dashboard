import { afterEach, describe, expect, it } from 'vitest';
import {
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

describe('selection persistence', () => {
  afterEach(() => localStorage.clear());

  it('round-trips a selection through localStorage', () => {
    saveSelection([3, 7, 9]);
    expect(loadSelection()).toEqual([3, 7, 9]);
  });

  it('returns null when nothing is stored', () => {
    expect(loadSelection()).toBeNull();
  });

  it('returns null for malformed storage', () => {
    localStorage.setItem('rod.team.selectedUserIds', '{not json');
    expect(loadSelection()).toBeNull();
  });
});
