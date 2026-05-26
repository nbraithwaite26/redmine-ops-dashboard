import { useEffect, useMemo, useState } from 'react';
import AddTimeModal from '../components/AddTimeModal';
import TeamHours from '../components/TeamHours';
import UserHoursCard from '../components/UserHoursCard';
import UserHoursSection from '../components/UserHoursSection';
import { useReadOnly } from '../hooks/useReadOnly';
import { weekRange } from '../lib/hoursAggregate';
import { findProjectByPath } from '../lib/projectTree';
import { getProjects, getTeamSchedule } from '../services/redmineApi';
import { DEFAULT_PROJECT_SOURCE } from '../services/projectSource';
import type { Issue, User } from '../types/redmine';

/**
 * Hours / Time Tracking landing.
 *
 * Two stacked sections:
 *   - This week  (Monday → today)
 *   - Last week  (the full previous Monday → Sunday block)
 *
 * Each section renders user cards. Cards expand into projects; projects
 * expand into tasks; each task has a Log time button that opens the
 * AddTimeModal. Both sections use the same card layout so users can
 * compare current vs. prior week without a context switch.
 */
export default function Hours() {
  const { readOnly } = useReadOnly();

  // Compute once per mount — these are date ranges, not reactive state.
  const thisWeek = useMemo(() => weekRange(0), []);
  const lastWeek = useMemo(() => weekRange(-1), []);

  // The AddTimeModal lives at the page level so any task row (in either
  // section) can launch it. Pre-seeding lands in commit 3.
  const [logTimeTarget, setLogTimeTarget] = useState<Issue | null>(null);
  // Bumped after a successful log so both week sections (and the team
  // schedule) re-fetch and the new entry shows without a manual reload.
  const [reloadKey, setReloadKey] = useState(0);

  // Team schedule (Gantt) — scoped to the AIRCRAFT ENGINEERING project tree
  // (CR #16). Users are derived from assignees so the chart works even though
  // /users 403s for non-admin keys.
  const [ganttUsers, setGanttUsers] = useState<User[]>([]);
  const [ganttIssues, setGanttIssues] = useState<Issue[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setTeamLoading(true);
    (async () => {
      const projects = await getProjects();
      const root = findProjectByPath(projects, DEFAULT_PROJECT_SOURCE.path);
      const { users, issues } = await getTeamSchedule(root?.id);
      if (cancelled) return;
      setGanttUsers(users);
      setGanttIssues(issues);
      setTeamLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Hours</h1>
        <p className="text-sm text-ink-muted">
          Per-engineer summary of this week and last week. Click a card to drill into
          projects and tasks.
        </p>
      </header>

      <UserHoursSection
        title="This week"
        range={thisWeek}
        readOnly={readOnly}
        refreshToken={reloadKey}
        onLogTime={setLogTimeTarget}
        renderCard={(summary, ro, onLog) => (
          <UserHoursCard summary={summary} readOnly={ro} onLogTime={onLog} />
        )}
      />

      <UserHoursSection
        title="Last week"
        range={lastWeek}
        readOnly={readOnly}
        refreshToken={reloadKey}
        onLogTime={setLogTimeTarget}
        renderCard={(summary, ro, onLog) => (
          <UserHoursCard summary={summary} readOnly={ro} onLogTime={onLog} />
        )}
      />

      <TeamHours
        users={ganttUsers}
        issues={ganttIssues}
        loading={teamLoading}
        readOnly={readOnly}
        onLogTime={setLogTimeTarget}
      />

      {logTimeTarget && (
        <AddTimeModal
          initialProjectId={logTimeTarget.projectId}
          initialIssueId={logTimeTarget.id}
          onClose={() => setLogTimeTarget(null)}
          onCreated={() => {
            setLogTimeTarget(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
