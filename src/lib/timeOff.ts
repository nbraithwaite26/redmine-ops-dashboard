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

export { iso as isoDate };
