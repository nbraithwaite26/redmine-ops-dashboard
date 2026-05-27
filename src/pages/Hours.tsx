import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
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

const TEAM_PREF_KEY = 'rod.hours.showTeam';

/**
 * Hours / Time Tracking landing — personal-first.
 *
 * Two stacked sections (this week, last week) of the current user's hours.
 * The team schedule (Gantt across the AIRCRAFT ENGINEERING portfolio) is
 * opt-in behind a toggle, and is only fetched when first shown — that fetch
 * paginates ~700 rows live, so deferring it keeps the personal page fast.
 */
export default function Hours() {
  const { readOnly } = useReadOnly();

  const thisWeek = useMemo(() => weekRange(0), []);
  const lastWeek = useMemo(() => weekRange(-1), []);

  const [logTimeTarget, setLogTimeTarget] = useState<Issue | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Team schedule is opt-in (personal-first page). Persist the choice.
  const [showTeam, setShowTeam] = useState<boolean>(() => {
    try {
      return localStorage.getItem(TEAM_PREF_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggleTeam = () =>
    setShowTeam((v) => {
      const next = !v;
      try {
        localStorage.setItem(TEAM_PREF_KEY, next ? '1' : '0');
      } catch {
        // ignore storage failures
      }
      return next;
    });

  const [ganttUsers, setGanttUsers] = useState<User[]>([]);
  const [ganttIssues, setGanttIssues] = useState<Issue[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);

  // Fetch the team schedule only while the team view is shown. Users are
  // derived from assignees so the chart works even though /users 403s for
  // non-admin keys (CR #16). Refetches when reloadKey bumps after a log.
  useEffect(() => {
    if (!showTeam) return;
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
  }, [showTeam, reloadKey]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Hours</h1>
        <p className="text-sm text-ink-muted">
          Your hours this week and last week. Click a card to drill into projects and tasks.
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

      <section>
        <button
          type="button"
          onClick={toggleTeam}
          className="flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink"
          aria-expanded={showTeam}
          data-testid="hours-team-toggle"
        >
          {showTeam ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Users size={14} />
          {showTeam ? 'Hide team schedule' : 'Show team schedule'}
        </button>

        {showTeam && (
          <div className="mt-3">
            <TeamHours
              users={ganttUsers}
              issues={ganttIssues}
              loading={teamLoading}
              readOnly={readOnly}
              onLogTime={setLogTimeTarget}
            />
          </div>
        )}
      </section>

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
