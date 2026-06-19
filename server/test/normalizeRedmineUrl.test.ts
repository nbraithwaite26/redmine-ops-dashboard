import { describe, expect, it } from 'vitest';
import { normalizeRedmineUrl } from '../src/routes/portableAuth.js';

describe('normalizeRedmineUrl', () => {
  it('strips trailing slash', () => {
    expect(normalizeRedmineUrl('https://redmine.example.com/')).toBe(
      'https://redmine.example.com',
    );
  });

  it('strips /login', () => {
    expect(normalizeRedmineUrl('https://redmine.example.com/login')).toBe(
      'https://redmine.example.com',
    );
  });

  it('strips /my/page', () => {
    expect(normalizeRedmineUrl('https://redmine.example.com/my/page')).toBe(
      'https://redmine.example.com',
    );
  });

  it('strips /projects/123/issues/45 back to root', () => {
    expect(
      normalizeRedmineUrl('https://redmine.example.com/projects/123/issues/45'),
    ).toBe('https://redmine.example.com');
  });

  it('preserves a subpath install', () => {
    expect(normalizeRedmineUrl('https://example.com/redmine')).toBe(
      'https://example.com/redmine',
    );
  });

  it('strips UI path under a subpath install', () => {
    expect(normalizeRedmineUrl('https://example.com/redmine/login')).toBe(
      'https://example.com/redmine',
    );
  });

  it('leaves a plain host alone', () => {
    expect(normalizeRedmineUrl('https://redmine.example.com')).toBe(
      'https://redmine.example.com',
    );
  });
});
