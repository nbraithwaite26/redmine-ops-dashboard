import type { TimeOffEntry } from '../types/redmine';

export interface DateRange {
  /** ISO YYYY-MM-DD, inclusive. */
  from: string;
  to: string;
}

// ─── Colors ────────────────────────────────────────────────────────────────

/** Known leave types → hex color (mirrors the AE calendar palette). */
const TYPE_COLORS: Record<string, string> = {
  vacation: '#0EA5E9', // sky
  'personal time': '#8B5CF6', // violet
  holiday: '#F59E0B', // amber
  'customer visit': '#10B981', // green
};

const FALLBACK_COLORS = ['#EF4444', '#EC4899', '#14B8A6', '#6366F1', '#84CC16'];

/** Stable color for a leave type — known types are fixed; others hash to a palette. */
export function timeOffColor(type: string): string {
  const key = type.trim().toLowerCase();
  // Match on a known prefix so "Customer Visit (FOF/FOT)" maps to "customer visit".
  for (const known of Object.keys(TYPE_COLORS)) {
    if (key.startsWith(known)) return TYPE_COLORS[known];
  }
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

/** Count of distinct engineers with any time-off entry in the set. */
export function distinctEngineersOut(entries: ReadonlyArray<TimeOffEntry>): number {
  return new Set(entries.map((e) => e.user.id)).size;
}

/** Distinct leave types present, in first-seen order — used to build the legend. */
export function legendTypes(entries: ReadonlyArray<TimeOffEntry>): string[] {
  const seen: string[] = [];
  for (const e of entries) if (!seen.includes(e.type)) seen.push(e.type);
  return seen;
}

/** Group entries by ISO date (YYYY-MM-DD). */
export function groupByDate(
  entries: ReadonlyArray<TimeOffEntry>,
): Map<string, TimeOffEntry[]> {
  const map = new Map<string, TimeOffEntry[]>();
  for (const e of entries) {
    const bucket = map.get(e.date);
    if (bucket) bucket.push(e);
    else map.set(e.date, [e]);
  }
  return map;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(ref: Date): Date {
  const day = ref.getDay();
  const offset = day === 0 ? -6 : 1 - day; // Monday-anchored
  const m = new Date(ref);
  m.setDate(ref.getDate() + offset);
  m.setHours(0, 0, 0, 0);
  return m;
}

/** The 7 dates (Mon→Sun) of the week containing `reference`, shifted by `offset` weeks. */
export function weekDays(reference: Date, offset = 0): Date[] {
  const monday = startOfWeek(reference);
  monday.setDate(monday.getDate() + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/** Inclusive ISO range covering the given dates (first → last). */
export function rangeOf(dates: Date[]): DateRange {
  return { from: iso(dates[0]), to: iso(dates[dates.length - 1]) };
}

/** All dates of the month containing `reference`, shifted by `offset` months. */
export function monthDays(reference: Date, offset = 0): Date[] {
  const first = new Date(reference.getFullYear(), reference.getMonth() + offset, 1);
  const days: Date[] = [];
  for (let d = new Date(first); d.getMonth() === first.getMonth(); d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

// ─── Anchor-based navigation (single date drives both week + month) ───────
// The OOO calendar moved from an `(view, offsetFromToday)` model to an
// `(view, anchorIso)` model so toggling between week and month no longer
// snaps back to today. Helpers below are pure date arithmetic on local
// Date objects (no UTC drift).

/** Parse 'YYYY-MM-DD' as a local-midnight Date. */
export function parseAnchor(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y as number, (m as number) - 1, d as number);
}

/** Format a Date as 'YYYY-MM-DD' using local components. */
export function formatAnchor(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Returns the YYYY-MM-DD ISO of `today()` in local time. */
export function todayAnchor(today: Date): string {
  return formatAnchor(today);
}

/** Add `n` days to an anchor ISO and return a new anchor ISO. */
export function addDays(anchorIso: string, n: number): string {
  const d = parseAnchor(anchorIso);
  d.setDate(d.getDate() + n);
  return formatAnchor(d);
}

/** Add `n` calendar months to an anchor ISO. Day clamps so e.g. Mar 31 + 1
 *  month → Apr 30 (not May 1) — matches user expectations. */
export function addMonths(anchorIso: string, n: number): string {
  const src = parseAnchor(anchorIso);
  const targetMonth = src.getMonth() + n;
  // Build target first-of-month then clamp day to that month's last day.
  const firstOfTarget = new Date(src.getFullYear(), targetMonth, 1);
  const lastOfTarget = new Date(
    firstOfTarget.getFullYear(),
    firstOfTarget.getMonth() + 1,
    0,
  ).getDate();
  const clampedDay = Math.min(src.getDate(), lastOfTarget);
  return formatAnchor(new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), clampedDay));
}

/** 7 Mon→Sun dates of the week CONTAINING `anchorIso`. */
export function weekDaysOf(anchorIso: string): Date[] {
  return weekDays(parseAnchor(anchorIso));
}

/** Dates of the month CONTAINING `anchorIso`. */
export function monthDaysOf(anchorIso: string): Date[] {
  return monthDays(parseAnchor(anchorIso));
}

// ─── AE-Calendar-style grid (Sun-anchored, 6 weeks, ISO week numbers) ─────

export interface MonthGridCell {
  date: Date;
  iso: string;
  /** True when the cell belongs to the previous or next month — the AE
   *  Calendar shows these dimmed. */
  outsideMonth: boolean;
}

export interface MonthGridRow {
  /** ISO 8601 week number for this row (1–53). */
  weekNumber: number;
  cells: MonthGridCell[];
}

/**
 * ISO 8601 week number. Standard definition: weeks start on Monday; the
 * week containing the first Thursday of a year is week 1. Used in the AE
 * Calendar's left margin.
 */
export function isoWeekNumber(date: Date): number {
  // Copy + zero the time, then shift to the Thursday of the same week.
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000) + 1) / 7);
}

/**
 * Build a 6-row × 7-column Sun-anchored grid for the month containing the
 * anchor. Each row carries its ISO week number; cells outside the anchor's
 * month are flagged so the UI can dim them.
 *
 * 6 rows is enough for every Gregorian month (max 31 days + 6 leading days
 * still fits). When a month happens to fit in 5 rows, the 6th row carries
 * trailing days from the NEXT month — matching the screenshot's behavior.
 */
export function monthGridRowsOf(anchorIso: string): MonthGridRow[] {
  const anchor = parseAnchor(anchorIso);
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  // Find the most recent Sunday on/before the first of the month.
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
  // 6 rows × 7 days = 42 cells.
  const rows: MonthGridRow[] = [];
  for (let row = 0; row < 6; row++) {
    const cells: MonthGridCell[] = [];
    for (let col = 0; col < 7; col++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + row * 7 + col);
      cells.push({
        date: d,
        iso: formatAnchor(d),
        outsideMonth: d.getMonth() !== anchor.getMonth(),
      });
    }
    // ISO week number is read off any day in the row — use Wednesday so
    // we land squarely inside the week regardless of Sun/Mon anchoring.
    rows.push({ weekNumber: isoWeekNumber(cells[3]!.date), cells });
  }
  return rows;
}

/** Sun-anchored 7 dates of the week containing `anchorIso`. */
export function weekDaysSunOf(anchorIso: string): Date[] {
  const d = parseAnchor(anchorIso);
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(sunday);
    dd.setDate(sunday.getDate() + i);
    return dd;
  });
}

/** Human label for the visible window (week or month) at the given anchor. */
export function periodLabel(anchorIso: string, view: 'week' | 'month'): string {
  if (view === 'month') {
    return parseAnchor(anchorIso).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  }
  const days = weekDaysOf(anchorIso);
  const first = days[0];
  const last = days[days.length - 1];
  const sameMonth = first.getMonth() === last.getMonth();
  const firstFmt = first.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const lastFmt = sameMonth
    ? last.toLocaleDateString(undefined, { day: 'numeric' })
    : last.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${firstFmt} – ${lastFmt} ${last.getFullYear()}`;
}

export { iso as isoDate };
