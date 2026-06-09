import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, MotionConfig } from 'framer-motion';
import clsx from 'clsx';
import TeamMemberCard from './TeamMemberCard';
import TeamMemberDetail from './TeamMemberDetail';
import TeamMemberSelector from './TeamMemberSelector';
import { aggregateHours, weekRange } from '../lib/hoursAggregate';
import { findProjectByPath } from '../lib/projectTree';
import { DEFAULT_PROJECT_SOURCE } from '../services/projectSource';
import {
  getGroup,
  getGroups,
  getProjects,
  getTeamSchedule,
  getTimeEntries,
} from '../services/redmineApi';
import {
  defaultSelectedForWorkspace,
  loadSelection,
} from '../lib/teamSelection';
import { useAircraftGroupMembers } from '../hooks/useAircraftGroupMembers';
import { useWorkspace } from '../hooks/useWorkspace';
import { useSelectedTeam } from '../hooks/useSelectedTeam';
import type { GroupSummary, Issue, TimeEntry, User } from '../types/redmine';

export type WeekOffset = 0 | -1;

interface Props {
  /** Controlled week selection. When omitted, the panel manages its own. */
  week?: WeekOffset;
  onWeekChange?: (week: WeekOffset) => void;
  /**
   * Fires whenever the visible-engineer total changes. Lets the parent
   * Dashboard scope its "Team hours" metric to the same engineers shown
   * in the picker, so the card reflects exactly what's on screen.
   */
  onSelectedHoursChange?: (totalHours: number) => void;
  /**
   * Fires whenever the count of tasks assigned to the visible engineers
   * changes. Same idea as onSelectedHoursChange but for the assigned-
   * tasks metric.
   */
  onSelectedTasksChange?: (totalTasks: number) => void;
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
export default function TeamWorkPanel({
  week: weekProp,
  onWeekChange,
  onSelectedHoursChange,
  onSelectedTasksChange,
}: Props = {}) {
  // Controlled by the parent when props are supplied; otherwise self-managed.
  const [weekState, setWeekState] = useState<WeekOffset>(0);
  const week = weekProp ?? weekState;
  const setWeek = onWeekChange ?? setWeekState;
  const range = useMemo(() => weekRange(week), [week]);

  const [users, setUsers] = useState<User[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  // Team selection lives in a shared hook so every team-scoped metric across
  // the site sees the same value. The panel is the WRITER; everywhere else
  // is a read-only consumer. `null` here means we haven't initialized yet.
  const { selectedIds, setSelectedIds } = useSelectedTeam();
  const [openId, setOpenId] = useState<number | null>(null);

  const { workspace } = useWorkspace();
  // (eng) Aircraft group member IDs — used to compute the engineering
  // workspace's default selection. Shared with the Engineers Out card on
  // the Dashboard via this hook so we don't double-fetch.
  const { memberIds: aircraftMemberIds } = useAircraftGroupMembers();
  // The full group catalog for the picker dropdown.
  const [groupCatalog, setGroupCatalog] = useState<GroupSummary[]>([]);

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

  // Group catalog for the picker dropdown. (eng) Aircraft membership is
  // handled by useAircraftGroupMembers above so the Engineers Out card and
  // this panel share the same fetch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cat = await getGroups();
        if (!cancelled) setGroupCatalog(cat);
      } catch {
        if (!cancelled) setGroupCatalog([]);
      }
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

  // Initialize / re-initialize selection whenever the workspace changes.
  // Per-workspace persisted choice wins (pruned to engineers that still
  // exist); otherwise apply the workspace-aware default (eng → (eng) Aircraft
  // intersection, ops → everyone).
  //
  // Wait for the aircraft-group fetch to resolve before computing the eng
  // default — otherwise the very first paint would fall back to the legacy
  // name/login heuristic and then re-render. For 'ops' the group isn't
  // needed, so don't block on it.
  useEffect(() => {
    if (rows.length === 0) return;
    if (workspace === 'eng' && aircraftMemberIds === null) return;
    const roster = rows.map((r) => r.user);
    const stored = loadSelection(workspace);
    if (stored) {
      const valid = stored.filter((id) => rows.some((r) => r.user.id === id));
      if (valid.length > 0) {
        setSelectedIds(valid);
        return;
      }
    }
    setSelectedIds(defaultSelectedForWorkspace(workspace, roster, aircraftMemberIds));
  }, [rows, workspace, aircraftMemberIds]);

  const effectiveSelected = useMemo(() => selectedIds ?? [], [selectedIds]);
  const visibleRows = useMemo(
    () => rows.filter((r) => effectiveSelected.includes(r.user.id)),
    [rows, effectiveSelected],
  );
  const openRow = useMemo(
    () => rows.find((r) => r.user.id === openId) ?? null,
    [rows, openId],
  );

  // Totals across only the currently-visible (selected) engineers.
  // Reported up so the Dashboard's "Team hours" and "Assigned tasks"
  // metrics scope to the same set the picker is showing.
  const visibleHoursTotal = useMemo(
    () =>
      Math.round(
        visibleRows.reduce((sum, r) => sum + r.totalHours, 0) * 10,
      ) / 10,
    [visibleRows],
  );

  const visibleTasksTotal = useMemo(
    () => visibleRows.reduce((sum, r) => sum + r.taskCount, 0),
    [visibleRows],
  );

  useEffect(() => {
    onSelectedHoursChange?.(visibleHoursTotal);
  }, [visibleHoursTotal, onSelectedHoursChange]);

  useEffect(() => {
    onSelectedTasksChange?.(visibleTasksTotal);
  }, [visibleTasksTotal, onSelectedTasksChange]);

  const updateSelection = (ids: number[]) => {
    // useSelectedTeam.setSelectedIds writes localStorage + broadcasts to
    // every other team-scoped consumer (Dashboard, Home, …) so this is
    // the only call site needed.
    setSelectedIds(ids);
    if (openId !== null && !ids.includes(openId)) setOpenId(null);
  };

  // Apply a Redmine group as the active team: intersect group members with
  // the visible roster so we don't show engineers without assigned work.
  const applyGroup = async (groupId: number) => {
    try {
      const g = await getGroup(groupId);
      const memberIds = new Set(g.members.map((u) => u.id));
      const intersected = rows
        .map((r) => r.user.id)
        .filter((id) => memberIds.has(id));
      // If nobody in the group has tracked work this week, fall back to the
      // unfiltered group members so the picker has visible effect.
      updateSelection(
        intersected.length > 0 ? intersected : [...memberIds],
      );
    } catch {
      // Toast surfaces from the HTTP layer; selection stays unchanged.
    }
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
            {groupCatalog.length > 0 && (
              <label className="text-sm">
                <span className="sr-only">Team source group</span>
                <select
                  data-testid="team-group-picker"
                  aria-label="Team source group"
                  // Native <option> popups inherit the page background. In
                  // dark mode that leaves the panel white-on-white without
                  // `color-scheme: dark`. Setting it to "light dark" lets the
                  // OS render the popup against the current theme.
                  style={{ colorScheme: 'light dark' }}
                  className="rounded-md border border-gray-200 dark:border-white/20 bg-[var(--bg-card)] text-ink px-2 py-1.5 text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    if (Number.isFinite(id) && id > 0) {
                      void applyGroup(id);
                    }
                    // Reset the picker — the active selection is reflected
                    // through TeamMemberSelector and the card grid, not here.
                    e.currentTarget.value = '';
                  }}
                >
                  <option value="">Set team to…</option>
                  {groupCatalog.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
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
