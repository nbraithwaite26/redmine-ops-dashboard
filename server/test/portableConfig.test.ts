/**
 * Round-trip tests for the per-user portable config file. Uses a temp
 * directory via PORTABLE_CONFIG_PATH so the host's real config isn't
 * touched.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'rod-portable-'));
  process.env.PORTABLE_CONFIG_PATH = join(tmpRoot, 'config.json');
});

afterEach(() => {
  delete process.env.PORTABLE_CONFIG_PATH;
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('portableConfig', () => {
  it('readPortableConfig returns null before anything is written', async () => {
    const { readPortableConfig, _resetPortableConfigCacheForTests } = await import(
      '../src/portableConfig.js'
    );
    _resetPortableConfigCacheForTests();
    expect(readPortableConfig()).toBeNull();
  });

  it('writePortableConfig persists and readPortableConfig returns it', async () => {
    const { writePortableConfig, readPortableConfig, _resetPortableConfigCacheForTests } =
      await import('../src/portableConfig.js');
    _resetPortableConfigCacheForTests();

    writePortableConfig({
      redmineBaseUrl: 'https://redmine.example.com/',
      redmineApiKey: 'secret-123',
      login: 'nbraithwaite',
      loggedInAt: '2026-06-17T12:00:00.000Z',
    });

    _resetPortableConfigCacheForTests();
    const got = readPortableConfig();
    expect(got).not.toBeNull();
    expect(got?.redmineBaseUrl).toBe('https://redmine.example.com'); // trailing slash trimmed
    expect(got?.redmineApiKey).toBe('secret-123');
    expect(got?.login).toBe('nbraithwaite');
  });

  it('clearPortableConfig removes the file and subsequent reads return null', async () => {
    const {
      writePortableConfig,
      clearPortableConfig,
      readPortableConfig,
      getPortableConfigPath,
      _resetPortableConfigCacheForTests,
    } = await import('../src/portableConfig.js');
    _resetPortableConfigCacheForTests();

    writePortableConfig({
      redmineBaseUrl: 'https://redmine.example.com',
      redmineApiKey: 'k',
      login: 'u',
      loggedInAt: '2026-06-17T12:00:00.000Z',
    });
    expect(existsSync(getPortableConfigPath())).toBe(true);

    clearPortableConfig();
    expect(existsSync(getPortableConfigPath())).toBe(false);

    _resetPortableConfigCacheForTests();
    expect(readPortableConfig()).toBeNull();
  });

  it('treats a corrupted file as unconfigured', async () => {
    const {
      readPortableConfig,
      getPortableConfigPath,
      _resetPortableConfigCacheForTests,
    } = await import('../src/portableConfig.js');
    _resetPortableConfigCacheForTests();
    // Write garbage to the config path so JSON.parse fails.
    const path = getPortableConfigPath();
    const { mkdirSync } = await import('node:fs');
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, '{ not valid json');
    expect(readPortableConfig()).toBeNull();
  });

  it('only writes the api_key — not the password — to the config file', async () => {
    const {
      writePortableConfig,
      getPortableConfigPath,
      _resetPortableConfigCacheForTests,
    } = await import('../src/portableConfig.js');
    _resetPortableConfigCacheForTests();

    writePortableConfig({
      redmineBaseUrl: 'https://redmine.example.com',
      redmineApiKey: 'persisted-api-key',
      login: 'nbraithwaite',
      loggedInAt: '2026-06-17T12:00:00.000Z',
    });

    const raw = readFileSync(getPortableConfigPath(), 'utf8');
    expect(raw).toContain('persisted-api-key');
    expect(raw).not.toContain('password');
  });
});
