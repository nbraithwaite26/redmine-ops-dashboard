import { describe, expect, it } from 'vitest';
import { adaptUser, adaptUserFromRef } from '../src/adapters/user.js';
import userFixture from './fixtures/user.current.json' with { type: 'json' };

describe('adaptUser', () => {
  it('produces a normalized user from a full Redmine user payload', () => {
    const out = adaptUser(userFixture.user);
    expect(out).toEqual({
      id: 42,
      name: 'Test One',
      email: 'test.one@example.invalid',
      login: 'test.user',
      status: 'Active',
      groups: [],
      roles: [],
    });
  });

  it('falls back to login when firstname/lastname missing', () => {
    const out = adaptUser({ id: 9, firstname: '', lastname: '', login: 'fallback' });
    expect(out.name).toBe('fallback');
  });

  it('marks inactive when status != 1', () => {
    const out = adaptUser({ id: 9, firstname: 'X', lastname: 'Y', status: 3 });
    expect(out.status).toBe('Inactive');
  });
});

describe('adaptUserFromRef', () => {
  it('returns null when no ref', () => {
    expect(adaptUserFromRef(null)).toBeNull();
    expect(adaptUserFromRef(undefined)).toBeNull();
  });

  it('produces a minimal user with empty email/login from a ref', () => {
    const out = adaptUserFromRef({ id: 11, name: 'Test Two' });
    expect(out).toEqual({
      id: 11,
      name: 'Test Two',
      email: '',
      login: '',
      status: 'Active',
      groups: [],
      roles: [],
    });
  });
});
