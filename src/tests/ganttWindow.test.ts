import { describe, expect, it } from 'vitest';
import {
  ZOOM_PRESETS,
  clipBarToWindow,
  dayIndexInWindow,
  defaultWindowStart,
  parseLocalIso,
  windowDates,
} from '../lib/ganttWindow';

// Use parseLocalIso for any 'YYYY-MM-DD' input so tests run identically in
// every timezone. Plain `new Date('2026-06-01')` would parse as UTC midnight
// and flip across the date line in negative-offset zones.
const d = parseLocalIso;

describe('ZOOM_PRESETS', () => {
  it('covers all five zoom levels with positive days + cell width', () => {
    for (const level of ['Day', 'Week', 'Month', 'Quarter', 'Year'] as const) {
      const p = ZOOM_PRESETS[level];
      expect(p.days).toBeGreaterThan(0);
      expect(p.cellWidth).toBeGreaterThan(0);
    }
  });

  it('orders cell widths from largest (Day) to smallest (Year)', () => {
    expect(ZOOM_PRESETS.Day.cellWidth).toBeGreaterThan(ZOOM_PRESETS.Week.cellWidth);
    expect(ZOOM_PRESETS.Week.cellWidth).toBeGreaterThan(ZOOM_PRESETS.Month.cellWidth);
    expect(ZOOM_PRESETS.Month.cellWidth).toBeGreaterThan(ZOOM_PRESETS.Quarter.cellWidth);
    expect(ZOOM_PRESETS.Quarter.cellWidth).toBeGreaterThan(ZOOM_PRESETS.Year.cellWidth);
  });
});

describe('defaultWindowStart', () => {
  it('returns a Monday for any reference date', () => {
    for (let i = 0; i < 14; i++) {
      const ref = new Date(2026, 5, 1 + i); // June 1..14 2026 (local)
      const isoStart = defaultWindowStart(ref, 28);
      const start = parseLocalIso(isoStart);
      // getDay(): 0 = Sunday, 1 = Monday
      expect(start.getDay()).toBe(1);
    }
  });

  it('keeps today comfortably inside the window (not at either edge)', () => {
    // The Monday snap can pull "back" by up to 6 extra days when the
    // back-of-window date is a Sunday, so today can land between days ~6
    // and ~20 in a 28-day window. We just assert it's clearly inside the
    // window and not pinned to either edge.
    const ref = new Date(2026, 5, 9); // Tuesday June 9 2026 (local)
    const isoStart = defaultWindowStart(ref, 28);
    const start = parseLocalIso(isoStart);
    const refMidnight = new Date(ref);
    refMidnight.setHours(0, 0, 0, 0);
    const diff = Math.round(
      (refMidnight.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
    );
    expect(diff).toBeGreaterThan(2);
    expect(diff).toBeLessThan(25);
  });
});

describe('windowDates', () => {
  it('returns N consecutive days starting at the ISO date', () => {
    const dates = windowDates('2026-06-01', 5);
    expect(dates).toHaveLength(5);
    expect(dates[0].getDate()).toBe(1);
    expect(dates[4].getDate()).toBe(5);
  });
});

describe('dayIndexInWindow', () => {
  it('returns 0 for the window start', () => {
    expect(dayIndexInWindow('2026-06-01', d('2026-06-01'))).toBe(0);
  });
  it('returns the diff in whole days', () => {
    expect(dayIndexInWindow('2026-06-01', d('2026-06-10'))).toBe(9);
  });
  it('returns negative for dates before the window', () => {
    expect(dayIndexInWindow('2026-06-10', d('2026-06-01'))).toBe(-9);
  });
});

describe('clipBarToWindow', () => {
  const start = '2026-06-01';
  const days = 14;
  const cell = 36;

  it('returns null for empty or invalid dates', () => {
    expect(clipBarToWindow(start, days, cell, '', '2026-06-05')).toBeNull();
    expect(clipBarToWindow(start, days, cell, 'not-a-date', '2026-06-05')).toBeNull();
  });

  it('returns null when the bar is entirely before the window', () => {
    expect(clipBarToWindow(start, days, cell, '2026-05-01', '2026-05-10')).toBeNull();
  });

  it('returns null when the bar is entirely after the window', () => {
    expect(clipBarToWindow(start, days, cell, '2026-07-01', '2026-07-10')).toBeNull();
  });

  it('renders an in-bounds bar with correct left + width', () => {
    // 2026-06-03 → 2026-06-05 = days 2..4 inclusive = 3 cells.
    const rect = clipBarToWindow(start, days, cell, '2026-06-03', '2026-06-05');
    expect(rect).not.toBeNull();
    expect(rect!.left).toBe(2 * cell + 2);
    expect(rect!.width).toBe(3 * cell - 4);
    expect(rect!.clippedLeft).toBe(false);
    expect(rect!.clippedRight).toBe(false);
  });

  it('clips on the left when the bar starts before the window', () => {
    const rect = clipBarToWindow(start, days, cell, '2026-05-25', '2026-06-04');
    expect(rect).not.toBeNull();
    expect(rect!.left).toBe(0 + 2);
    expect(rect!.clippedLeft).toBe(true);
    expect(rect!.clippedRight).toBe(false);
  });

  it('clips on the right when the bar ends after the window', () => {
    // window = 2026-06-01..2026-06-14
    const rect = clipBarToWindow(start, days, cell, '2026-06-10', '2026-06-25');
    expect(rect).not.toBeNull();
    expect(rect!.clippedRight).toBe(true);
    expect(rect!.clippedLeft).toBe(false);
  });

  it('rejects bars where end < start', () => {
    expect(clipBarToWindow(start, days, cell, '2026-06-10', '2026-06-05')).toBeNull();
  });
});
