import { describe, expect, it } from 'vitest';
import { isoWeekNumber, monthGridRowsOf, weekDaysSunOf } from '../lib/timeOff';

describe('isoWeekNumber', () => {
  it('returns ISO week 1 for early January when the week has Jan 4', () => {
    // 2026-01-05 is a Monday → ISO week 2; 2026-01-04 is Sunday → ISO week 1.
    expect(isoWeekNumber(new Date(2026, 0, 4))).toBe(1);
  });
  it('returns 23 for 2026-06-09 (matches the screenshot)', () => {
    // The screenshot shows week 23 starting at Sun May 31 → Sat Jun 6.
    // 2026-06-01 is a Monday in week 23.
    expect(isoWeekNumber(new Date(2026, 5, 1))).toBe(23);
  });
  it('returns 53 for the last days of a long year', () => {
    // 2020-12-31 was an ISO week 53 Thursday.
    expect(isoWeekNumber(new Date(2020, 11, 31))).toBe(53);
  });
});

describe('monthGridRowsOf', () => {
  it('returns exactly 6 rows × 7 cells (42 cells total)', () => {
    const rows = monthGridRowsOf('2026-06-15');
    expect(rows).toHaveLength(6);
    for (const r of rows) expect(r.cells).toHaveLength(7);
  });

  it('first row starts on a Sunday', () => {
    const rows = monthGridRowsOf('2026-06-15');
    // Sunday = 0
    expect(rows[0]!.cells[0]!.date.getDay()).toBe(0);
  });

  it('flags outsideMonth on leading/trailing cells', () => {
    const rows = monthGridRowsOf('2026-06-15');
    // 2026-06-01 is a Monday → cell index 1 (after Sun May 31). The Sunday
    // cell at row 0 col 0 belongs to May.
    expect(rows[0]!.cells[0]!.outsideMonth).toBe(true);
    expect(rows[0]!.cells[1]!.outsideMonth).toBe(false);
    // 2026-06-30 is a Tuesday → row 5 has trailing July days.
    const lastRow = rows[5]!;
    expect(lastRow.cells.some((c) => c.outsideMonth)).toBe(true);
  });

  it('row 0 week number for June 2026 is ISO week 23 (matches screenshot)', () => {
    const rows = monthGridRowsOf('2026-06-15');
    expect(rows[0]!.weekNumber).toBe(23);
  });

  it('week numbers are monotonically increasing within a month', () => {
    const rows = monthGridRowsOf('2026-06-15');
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]!.weekNumber;
      const cur = rows[i]!.weekNumber;
      // Allow a year wrap (week 1 after 52/53).
      if (cur > prev) {
        expect(cur).toBe(prev + 1);
      } else {
        expect([1]).toContain(cur);
      }
    }
  });
});

describe('weekDaysSunOf', () => {
  it('returns 7 days Sun→Sat for the week containing the anchor', () => {
    // 2026-06-09 is a Tuesday → Sun is 2026-06-07.
    const days = weekDaysSunOf('2026-06-09');
    expect(days).toHaveLength(7);
    expect(days[0]!.getDay()).toBe(0); // Sunday
    expect(days[0]!.getDate()).toBe(7);
    expect(days[6]!.getDay()).toBe(6); // Saturday
    expect(days[6]!.getDate()).toBe(13);
  });
});
