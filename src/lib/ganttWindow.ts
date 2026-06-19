/**
 * Pure helpers for the Resource Management Gantt chart.
 *
 * The component used to hardcode `startDate = '2026-05-18'` and `days = 21`,
 * which meant the camera was pointed at a fixed past window — most live
 * allocations fell outside it and the chart looked empty. These helpers move
 * the window math out of the component so it can be unit-tested and so the
 * Gantt can be driven by a zoom selector.
 */

// ─── Timezone-safe date helpers ───────────────────────────────────────────
// `new Date('2026-06-01')` parses as UTC midnight — then `getDay()` /
// `getDate()` return LOCAL values, which can wrap to the previous day in
// negative-offset zones (and the next day in positive ones). All window
// math here uses these helpers so a "Monday" stays a Monday regardless of
// where the user runs the app.

/** Parse 'YYYY-MM-DD' as a local-midnight Date (NOT UTC). */
export function parseLocalIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y as number, (m as number) - 1, d as number);
}

/** Format a Date as 'YYYY-MM-DD' using LOCAL components. */
export function formatLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export type ZoomLevel = 'Day' | 'Week' | 'Month' | 'Quarter' | 'Year';

export interface ZoomPreset {
  /** Total days drawn in the timeline. */
  days: number;
  /** Width of one day cell, in pixels. */
  cellWidth: number;
}

/**
 * Zoom presets. Pixel widths are chosen so the whole window fits the
 * available timeline pane on a typical 13" laptop screen without
 * scrolling at the right end of the spectrum:
 *
 * - Day      ~ 2 weeks @ 80 px = 1120 px wide (per-day detail)
 * - Week     ~ 4 weeks @ 36 px =  1008 px wide (default — what the chart used to show)
 * - Month    ~ 90 days @ 16 px =  1440 px wide (one quarter at a glance)
 * - Quarter  ~ 180 days @ 10 px = 1800 px wide
 * - Year     ~ 365 days @  6 px = 2190 px wide
 */
export const ZOOM_PRESETS: Record<ZoomLevel, ZoomPreset> = {
  Day: { days: 14, cellWidth: 80 },
  Week: { days: 28, cellWidth: 36 },
  Month: { days: 90, cellWidth: 16 },
  Quarter: { days: 180, cellWidth: 10 },
  Year: { days: 365, cellWidth: 6 },
};

/**
 * Returns the ISO YYYY-MM-DD start date for a window that centers `today`.
 *
 * "Center" means: start the window ~⅓ before today so the user lands on
 * recent-past + present + near-future. Snapped to the start of a Monday so
 * weekday headers line up consistently.
 */
export function defaultWindowStart(today: Date, daysVisible: number): string {
  const back = Math.floor(daysVisible / 3);
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - back);
  // Snap back to Monday so the day-of-week headers stay aligned.
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  // Format as local ISO so the string round-trips back through
  // parseLocalIso without a UTC drift.
  return formatLocalIso(d);
}

/**
 * Build the `daysVisible` consecutive Date objects starting at `startIso`.
 */
export function windowDates(startIso: string, daysVisible: number): Date[] {
  const start = parseLocalIso(startIso);
  return Array.from({ length: daysVisible }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/**
 * Day index (0-based) of `date` relative to the window start. May be negative
 * (date before window) or ≥ daysVisible (date after window).
 */
export function dayIndexInWindow(startIso: string, date: Date): number {
  const start = parseLocalIso(startIso);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

export interface BarRect {
  /** Left pixel offset within the timeline. */
  left: number;
  /** Bar width in pixels (always > 0). */
  width: number;
  /** True when the bar's real start is before the window — drew clipped. */
  clippedLeft: boolean;
  /** True when the bar's real end is after the window — drew clipped. */
  clippedRight: boolean;
}

/**
 * Compute the rectangle for an allocation bar inside the visible window.
 * Returns `null` when the bar is entirely outside the window (don't render).
 *
 * - Bars that straddle either edge are clipped to the window bounds and
 *   flagged via `clippedLeft` / `clippedRight` so the component can draw an
 *   indicator (e.g. a dashed end).
 * - Bars whose start/end are unparseable (empty string, invalid date) return
 *   null — caller must handle the "no data" case with its own placeholder.
 */
export function clipBarToWindow(
  startIso: string,
  daysVisible: number,
  cellWidth: number,
  barStartIso: string,
  barEndIso: string,
): BarRect | null {
  if (!barStartIso || !barEndIso) return null;
  // Bar dates from Redmine are bare 'YYYY-MM-DD'. Parse them in the same
  // local-midnight frame as the window so the day-index math doesn't drift
  // by one across timezones.
  const barStart = /^\d{4}-\d{2}-\d{2}$/.test(barStartIso)
    ? parseLocalIso(barStartIso)
    : new Date(barStartIso);
  const barEnd = /^\d{4}-\d{2}-\d{2}$/.test(barEndIso)
    ? parseLocalIso(barEndIso)
    : new Date(barEndIso);
  if (Number.isNaN(barStart.getTime()) || Number.isNaN(barEnd.getTime())) {
    return null;
  }
  if (barEnd < barStart) return null;

  const rawStart = dayIndexInWindow(startIso, barStart);
  const rawEnd = dayIndexInWindow(startIso, barEnd);

  // Entirely before the window or entirely after → drop.
  if (rawEnd < 0) return null;
  if (rawStart >= daysVisible) return null;

  const clippedLeft = rawStart < 0;
  const clippedRight = rawEnd >= daysVisible;
  const startIdx = Math.max(0, rawStart);
  const endIdx = Math.min(daysVisible - 1, rawEnd);

  const left = startIdx * cellWidth + 2;
  const width = (endIdx - startIdx + 1) * cellWidth - 4;
  if (width <= 0) return null;

  return { left, width, clippedLeft, clippedRight };
}
