/**
 * Pure-function tests for the anchor-date navigation introduced for the
 * Dashboard Overview time-off calendar. The intent is to lock down:
 *   - toggling week/month doesn't shift the anchor
 *   - prev/next moves by the right unit
 *   - addMonths clamps day-of-month so Mar 31 + 1 month = Apr 30
 *   - periodLabel renders the right string for each view
 *
 * No DOM, no fake timers, no timezone-dependent magic.
 */
import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  formatAnchor,
  monthDaysOf,
  parseAnchor,
  periodLabel,
  todayAnchor,
  weekDaysOf,
} from '../lib/timeOff';

describe('parseAnchor / formatAnchor', () => {
  it('round-trips through local midnight', () => {
    const iso = '2026-06-09';
    const d = parseAnchor(iso);
    expect(formatAnchor(d)).toBe(iso);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June (0-indexed)
    expect(d.getDate()).toBe(9);
  });
});

describe('todayAnchor', () => {
  it('formats the given Date as YYYY-MM-DD in local time', () => {
    const d = new Date(2026, 5, 9); // Local June 9 2026
    expect(todayAnchor(d)).toBe('2026-06-09');
  });
});

describe('addDays', () => {
  it('moves forward by N days', () => {
    expect(addDays('2026-06-09', 7)).toBe('2026-06-16');
  });
  it('moves backward by negative N', () => {
    expect(addDays('2026-06-09', -2)).toBe('2026-06-07');
  });
  it('crosses month boundaries correctly', () => {
    expect(addDays('2026-05-30', 7)).toBe('2026-06-06');
  });
});

describe('addMonths', () => {
  it('moves forward by N months', () => {
    expect(addMonths('2026-06-09', 1)).toBe('2026-07-09');
  });
  it('moves backward by negative N', () => {
    expect(addMonths('2026-06-09', -1)).toBe('2026-05-09');
  });
  it('clamps day-of-month when the target month is shorter', () => {
    // Mar 31 + 1 month → April only has 30 days → Apr 30.
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30');
  });
  it('crosses year boundaries correctly', () => {
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });
});

describe('weekDaysOf', () => {
  it('returns 7 Monday-anchored dates around the given anchor', () => {
    // 2026-06-09 is a Tuesday. The Monday of that week is 2026-06-08.
    const days = weekDaysOf('2026-06-09');
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(1); // Monday
    expect(days[0].getDate()).toBe(8);
    expect(days[6].getDate()).toBe(14);
  });
});

describe('monthDaysOf', () => {
  it('returns every day of the month containing the anchor', () => {
    const days = monthDaysOf('2026-06-15');
    expect(days[0].getDate()).toBe(1);
    expect(days[days.length - 1].getDate()).toBe(30); // June has 30 days
  });
});

describe('periodLabel', () => {
  it('formats a month label as "Month YYYY"', () => {
    expect(periodLabel('2026-06-09', 'month')).toBe('June 2026');
  });
  it('formats a within-month week label and avoids repeating the month name', () => {
    // 2026-06-08 (Mon) → 2026-06-14 (Sun). Exact locale ordering varies
    // (US "Jun 8" vs ISO "8 Jun") so we just check both ends + year and
    // that the month name appears only once.
    const label = periodLabel('2026-06-09', 'week');
    expect(label).toContain('Jun');
    expect(label).toContain('8');
    expect(label).toContain('14');
    expect(label).toContain('2026');
    // Month abbreviation only once (no "Jun ... Jun" repeat).
    expect(label.match(/Jun/g)?.length).toBe(1);
  });

  it('formats a cross-month week label with both month abbreviations', () => {
    // 2026-07-29 (Wed) → week spans Jul 27 → Aug 2.
    const label = periodLabel('2026-07-29', 'week');
    expect(label).toContain('Jul');
    expect(label).toContain('Aug');
    expect(label).toContain('27');
    expect(label).toContain('2');
    expect(label).toContain('2026');
  });
});
