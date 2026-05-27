import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, MotionConfig } from 'framer-motion';
import TeamMemberCard from './TeamMemberCard';
import TeamMemberDetail from './TeamMemberDetail';
import TeamMemberSelector from './TeamMemberSelector';
import { aggregateTeamFromIssues } from '../lib/hoursAggregate';
import { findProjectByPath } from '../lib/projectTree';
import { DEFAULT_PROJECT_SOURCE } from '../services/projectSource';
import { getProjects, getTeamSchedule } from '../services/redmineApi';
import {
  defaultSelectedUserIds,
  loadSelection,
  saveSelection,
} from '../lib/teamSelection';
import type { Issue, User } from '../types/redmine';

/**
 * "Your Team's Work" body: a selectable grid of engineer cards. Each card
 * expands into a full-screen detail sheet (Framer Motion shared layout).
 * Engineers + their per-project workload are derived from assignees via
 * getTeamSchedule (scoped to the AIRCRAFT ENGINEERING tree) so it works
 * without the admin-only /users endpoint.
 */
export default function TeamWorkPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  // null = not yet initialized from storage/defaults.
  const [selectedIds, setSelectedIds] = useState<number[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

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

  const rows = useMemo(() => aggregateTeamFromIssues(users, issues), [users, issues]);

  // Initialize selection once the roster lands: persisted choice (pruned to
  // engineers that still exist) wins, else the first-name defaults.
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
    // Close the detail if its engineer was just deselected.
    if (openId !== null && !ids.includes(openId)) setOpenId(null);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-3" data-testid="team-work-panel">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Team members</h2>
            <p className="text-xs text-ink-muted">
              Tap an engineer to expand their workload. Use the selector to choose who appears.
            </p>
          </div>
          <TeamMemberSelector
            users={rows.map((r) => r.user)}
            selected={effectiveSelected}
            onChange={updateSelection}
          />
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
                  row={row}
                  onSelect={() => setOpenId(row.user.id)}
                />
              ))}
            </div>

            <AnimatePresence>
              {openRow && (
                <TeamMemberDetail
                  key={openRow.user.id}
                  row={openRow}
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
