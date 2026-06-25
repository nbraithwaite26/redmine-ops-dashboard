import type { Issue, TimeEntry } from '../types/redmine';
import { formatAnchor, parseAnchor } from './timeOff';

export interface TimesheetWeek {
  /** ISO Monday → Sunday dates (7 entries). */
  days: Date[];
  /** Inclusive range covering the week. */
  from: string;
  to: string;
}

/** Build the Monday→Sunday week containing the given anchor ISO. */
export function weekOf(anchorIso: string): TimesheetWeek {
  const anchor = parseAnchor(anchorIso);
  const day = anchor.getDay(); // 0 = Sun, 1 = Mon, …
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() + offsetToMonday);
  monday.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  return {
    days,
    from: formatAnchor(days[0]!),
    to: formatAnchor(days[6]!),
  };
}

/** Step `n` weeks forward (or backward) from an anchor ISO. */
export function shiftWeeks(anchorIso: string, n: number): string {
  const d = parseAnchor(anchorIso);
  d.setDate(d.getDate() + n * 7);
  return formatAnchor(d);
}

export interface CellAggregate {
  /** Sum of hours across all entries on this (issue, day). */
  hours: number;
  /** Underlying entries, sorted by `updatedOn` desc so [0] is the newest. */
  entries: TimeEntry[];
}

/** key("123", "2026-06-08") → "123|2026-06-08"; null issueId → "p:42|date". */
export function cellKey(issueId: number | null, projectId: number, spentOn: string): string {
  return issueId === null ? `p:${projectId}|${spentOn}` : `i:${issueId}|${spentOn}`;
}

/**
 * Bucket entries by (issue, spentOn). Project-only entries (no issue) bucket
 * by (project, spentOn) so they still aggregate per day.
 */
export function aggregateByCell(
  entries: ReadonlyArray<TimeEntry>,
): Map<string, CellAggregate> {
  const map = new Map<string, CellAggregate>();
  for (const e of entries) {
    const key = cellKey(e.issueId, e.projectId, e.spentOn);
    const bucket = map.get(key);
    if (bucket) {
      bucket.hours += e.hours;
      bucket.entries.push(e);
    } else {
      map.set(key, { hours: e.hours, entries: [e] });
    }
  }
  for (const bucket of map.values()) {
    bucket.entries.sort((a, b) => (a.updatedOn < b.updatedOn ? 1 : a.updatedOn > b.updatedOn ? -1 : 0));
  }
  return map;
}

export interface ProjectRow {
  projectId: number;
  projectName: string;
  /** All assigned tasks for this project, sorted by id desc (newest first). */
  tasks: Issue[];
}

/**
 * Group already-filtered issues (e.g. result of `getMyIssues`) by project.
 * Returns one row per project, tasks newest-first inside each.
 */
export function groupByProject(issues: ReadonlyArray<Issue>): ProjectRow[] {
  const byProject = new Map<number, ProjectRow>();
  for (const issue of issues) {
    let row = byProject.get(issue.projectId);
    if (!row) {
      row = { projectId: issue.projectId, projectName: issue.projectName, tasks: [] };
      byProject.set(issue.projectId, row);
    }
    row.tasks.push(issue);
  }
  for (const row of byProject.values()) {
    row.tasks.sort((a, b) => b.id - a.id);
  }
  return Array.from(byProject.values()).sort((a, b) =>
    a.projectName.localeCompare(b.projectName),
  );
}

/** Sum of hours for `dayIso` across every supplied entry. */
export function dayTotal(entries: ReadonlyArray<TimeEntry>, dayIso: string): number {
  return entries.reduce((sum, e) => (e.spentOn === dayIso ? sum + e.hours : sum), 0);
}

/** Sum of all hours in the supplied entries. */
export function weekTotal(entries: ReadonlyArray<TimeEntry>): number {
  return entries.reduce((sum, e) => sum + e.hours, 0);
}

/** Human label for a week (e.g. "Jun 8 – 14, 2026" or "Jun 29 – Jul 5, 2026"). */
export function weekLabel(week: TimesheetWeek): string {
  const first = week.days[0]!;
  const last = week.days[6]!;
  const sameMonth = first.getMonth() === last.getMonth();
  const firstFmt = first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const lastFmt = sameMonth
    ? last.toLocaleDateString(undefined, { day: 'numeric' })
    : last.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${firstFmt} – ${lastFmt}, ${last.getFullYear()}`;
}

/** Format a number of hours for display. 0 → "—"; non-zero → "1.5". */
export function formatCellHours(hours: number): string {
  if (hours <= 0) return '—';
  // Drop a trailing `.0` so 8.0 reads as 8, but keep 1.5.
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

/** Parse user-typed input. Empty / non-numeric / negative → null. */
export function parseCellInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return 0;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  // Clamp to a sane upper bound — Redmine accepts up to 24*365 but a single
  // cell over 24 is almost certainly a typo. Caller can warn but we don't
  // reject here; just round to two decimals.
  return Math.round(n * 100) / 100;
}
