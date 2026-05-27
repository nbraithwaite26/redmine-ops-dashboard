import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, MotionConfig } from 'framer-motion';
import clsx from 'clsx';
import TeamMemberCard from './TeamMemberCard';
import TeamMemberDetail from './TeamMemberDetail';
import TeamMemberSelector from './TeamMemberSelector';
import { aggregateHours, weekRange } from '../lib/hoursAggregate';
import { findProjectByPath } from '../lib/projectTree';
import { DEFAULT_PROJECT_SOURCE } from '../services/projectSource';
import { getProjects, getTeamSchedule, getTimeEntries } from '../services/redmineApi';
import {
  defaultSelectedUserIds,
  loadSelection,
  saveSelection,
} from '../lib/teamSelection';
import type { Issue, TimeEntry, User } from '../types/redmine';

export type WeekOffset = 0 | -1;

interface Props {
  /** Controlled week selection. When omitted, the panel manages its own. */
  week?: WeekOffset;
  onWeekChange?: (week: WeekOffset) => void;
}

/**
 * "Your Team's Work" body: a selectable grid of engineer cards. Each card
 * expands into a full-screen detail sheet (Framer Motion shared layout).
 *
 * Engineers + their projects/tasks are derived from assignees via
 * getTeamSchedule (scoped to the AIRCRAFT ENGINEERING tree) so it works
 * without the admin-only /users endpoint. Hours shown are the hours *logged*
 * in the selected week (this / last), computed from time entries via
 * aggregateHours — the same week-scoped aggregation the Hours page uses.
 */
export default function TeamWorkPanel({ week: weekProp, onWeekChange }: Props = {}) {
  // Controlled by the parent when props are supplied; otherwise self-managed.
  const [weekState, setWeekState] = useState<WeekOffset>(0);
  const week = weekProp ?? weekState;
  const setWeek = onWeekChange ?? setWeekState;
  const range = useMemo(() => weekRange(week), [week]);

  const [users, setUsers] = useState<User[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  // null = not yet initialized from storage/defaults.
  const [selectedIds, setSelectedIds] = useState<number[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  // Roster + issues load once (independent of the selected week).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const projects = await getProjects();
      const root = findProjectByPath(projects, DEFAULT_PROJECT_SOURCE.path);
      const schedule = await getTeamSchedule(root?.id);
      if (cancelled) return;
      setUsers(schedule.users);
      setIssues(schedule.issues);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Time entries are re-fetched whenever the selected week changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const e = await getTimeEntries({ from: range.from, to: range.to });
      if (cancelled) return;
      setEntries(e);
    })();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  // Week-scoped per-user → per-project → per-task summaries. Keep only
  // engineers who actually have assigned work.
  const rows = useMemo(
    () => aggregateHours(users, issues, entries, range).filter((s) => s.taskCount > 0),
    [users, issues, entries, range],
  );

  // Initialize selection once the roster lands: persisted choice (pruned to
  // engineers that still exist) wins, else the first-name/login defaults.
  useEffect(() => {
    if (rows.length === 0) return;
    setSelectedIds((prev) => {
      if (prev !== null) return prev;
      const roster = rows.map((r) => r.user);
      const stored = loadSelection();
      if (stored) {
        const valid = stored.filter((id) => rows.some((r) => r.user.id === id));
        return valid.length > 0 ? valid : defaultSelectedUserIds(roster);
      }
      return defaultSelectedUserIds(roster);
    });
  }, [rows]);

  const effectiveSelected = useMemo(() => selectedIds ?? [], [selectedIds]);
  const visibleRows = useMemo(
    () => rows.filter((r) => effectiveSelected.includes(r.user.id)),
    [rows, effectiveSelected],
  );
  const openRow = useMemo(
    () => rows.find((r) => r.user.id === openId) ?? null,
    [rows, openId],
  );

  const updateSelection = (ids: number[]) => {
    setSelectedIds(ids);
    saveSelection(ids);
    if (openId !== null && !ids.includes(openId)) setOpenId(null);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-3" data-testid="team-work-panel">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Team members</h2>
            <p className="text-xs text-ink-muted">
              Hours logged {week === 0 ? 'this week' : 'last week'} ({range.label}). Tap an
              engineer to expand their workload.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="inline-flex overflow-hidden rounded-md border border-gray-200 text-sm"
              role="group"
              aria-label="Week"
            >
              <button
                type="button"
                onClick={() => setWeek(0)}
                aria-pressed={week === 0}
                data-testid="team-week-this"
                className={clsx(
                  'px-3 py-1.5',
                  week === 0 ? 'bg-brand-500 text-white' : 'text-ink-muted hover:text-ink',
                )}
              >
                This week
              </button>
              <button
                type="button"
                onClick={() => setWeek(-1)}
                aria-pressed={week === -1}
                data-testid="team-week-last"
                className={clsx(
                  'border-l border-gray-200 px-3 py-1.5',
                  week === -1 ? 'bg-brand-500 text-white' : 'text-ink-muted hover:text-ink',
                )}
              >
                Last week
              </button>
            </div>
            <TeamMemberSelector
              users={rows.map((r) => r.user)}
              selected={effectiveSelected}
              onChange={updateSelection}
            />
          </div>
        </div>

        {loading ? (
          <div className="card p-6 text-sm text-ink-muted" data-testid="team-work-loading">
            Loading team…
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="card p-6 text-sm text-ink-muted" data-testid="team-work-empty">
            {rows.length === 0
              ? 'No engineers with assigned work.'
              : 'No engineers selected — pick some from the selector.'}
          </div>
        ) : (
          <LayoutGroup>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleRows.map((row) => (
                <TeamMemberCard
                  key={row.user.id}
                  summary={row}
                  onSelect={() => setOpenId(row.user.id)}
                />
              ))}
            </div>

            <AnimatePresence>
              {openRow && (
                <TeamMemberDetail
                  key={openRow.user.id}
                  summary={openRow}
                  onClose={() => setOpenId(null)}
                />
              )}
            </AnimatePresence>
          </LayoutGroup>
        )}
      </div>
    </MotionConfig>
  );
}
