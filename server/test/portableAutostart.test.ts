/**
 * Tests for the portable autostart helper. The mutating calls require
 * Windows (and `reg.exe`); on other platforms we only verify the
 * `supported: false` short-circuit so the rest of the suite stays
 * platform-portable.
 */
import { describe, expect, it } from 'vitest';
import { platform } from 'node:os';
import {
  getAutostartStatus,
  isAutostartSupported,
  enableAutostart,
  disableAutostart,
} from '../src/portableAutostart.js';

describe('portableAutostart', () => {
  it('reports support matching the host OS', () => {
    expect(isAutostartSupported()).toBe(platform() === 'win32');
  });

  it('getAutostartStatus returns supported=false off-Windows', () => {
    if (platform() === 'win32') return;
    const s = getAutostartStatus();
    expect(s.supported).toBe(false);
    expect(s.enabled).toBe(false);
    expect(typeof s.exePath).toBe('string');
  });

  it('enable/disable throw off-Windows', () => {
    if (platform() === 'win32') return;
    expect(() => enableAutostart()).toThrow(/Windows/);
    expect(() => disableAutostart()).toThrow(/Windows/);
  });

  it('round-trip: enable then disable leaves the value gone (Windows only)', () => {
    if (platform() !== 'win32') return;
    // Best-effort — if the user genuinely has autostart on, restore it.
    const before = getAutostartStatus();
    const wasEnabled = before.enabled;

    const enabled = enableAutostart();
    expect(enabled.enabled).toBe(true);
    expect(enabled.registeredPath).toBeTruthy();

    const disabled = disableAutostart();
    expect(disabled.enabled).toBe(false);

    // Restore prior state so the test doesn't change the host.
    if (wasEnabled) enableAutostart();
  });
});
