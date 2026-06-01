import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import DashboardCard from '../components/DashboardCard';
import DashboardProjectHealth from '../components/DashboardProjectHealth';
import DashboardResourcePlanning from '../components/DashboardResourcePlanning';
import EngineersOutCard from '../components/EngineersOutCard';
import TeamWorkPanel, { type WeekOffset } from '../components/TeamWorkPanel';
import TimeOffDetail from '../components/TimeOffDetail';
import type { Issue } from '../types/redmine';
import {
  getIssues,
  getPastDueIssues,
  getTimeOff,
} from '../services/redmineApi';
import { buildTeamMetrics } from '../data/mockData';
import { weekRange } from '../lib/hoursAggregate';
import { distinctEngineersOut } from '../lib/timeOff';
import { today } from '../lib/format';
import { useSelectedTeam } from '../hooks/useSelectedTeam';

// Team-first Overview. Personal work (my tasks / my hours) now lives on the
// Tasks and Hours pages, so the Dashboard leads with the team: team metrics +
// the engineer cards. Project Health and Resource Planning remain as
// secondary tabs.
const TABS = ['Team', 'Project Health', 'Resource Planning'] as const;
type Tab = (typeof TABS)[number];

const TEAM_HOURS_TARGET = 360;

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('Team');
  // Week selection is shared: it drives both the team-hours metric card and
  // the engineer cards in TeamWorkPanel.
  const [week, setWeek] = useState<WeekOffset>(0);
  const range = useMemo(() => weekRange(week), [week]);

  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [pastDue, setPastDue] = useState<Issue[]>([]);
  const [teamLogged, setTeamLogged] = useState(0);
  const [selectedTasks, setSelectedTasks] = useState(0);
  const [outCount, setOutCount] = useState(0);
  const [timeOffOpen, setTimeOffOpen] = useState(false);

  // Globally-selected team — drives every team-scoped metric on the page.
  // `null` while the team panel is still initializing; that's also the
  // signal to `buildTeamMetrics` to show the legacy org-wide numbers
  // (rather than collapse to zero before the picker has loaded).
  const { selectedIds: selectedTeamIds } = useSelectedTeam();

  // Issue counts are not week-scoped — load once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [a, pd] = await Promise.all([getIssues(), getPastDueIssues()]);
      if (cancelled) return;
      setAllIssues(a);
      setPastDue(pd);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Team-hours total is computed by TeamWorkPanel and lifted up here, so
  // the metric scopes to the same engineers visible in the picker.
  // The team-hours useEffect that summed every entry was removed: it was
  // counting people who weren't on this page's team (sshrestha, grios,
  // lsanford, enorde, …), which mis-stated the "team hours" total.
  // Reset to 0 when the week changes so we don't briefly show a stale
  // number from the previous week while TeamWorkPanel re-aggregates.
  useEffect(() => {
    setTeamLogged(0);
  }, [range.from, range.to]);

  // Engineers out in the selected week (drives the Engineers-out card).
  // When a team selection is active, filter the time-off entries down to
  // that subset so the card reflects "engineers in MY team who are out".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const off = await getTimeOff({ from: range.from, to: range.to });
      if (cancelled) return;
      const scoped = selectedTeamIds
        ? off.filter((e) => selectedTeamIds.includes(e.user.id))
        : off;
      setOutCount(distinctEngineersOut(scoped));
    })();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, selectedTeamIds]);

  // Open issues due within the next 7 days (today inclusive).
  const dueThisWeekCount = useMemo(() => {
    const start = today();
    const startIso = start.toISOString().slice(0, 10);
    const endDate = new Date(start);
    endDate.setDate(start.getDate() + 7);
    const endIso = endDate.toISOString().slice(0, 10);
    return allIssues.filter(
      (i) => !i.closedOn && i.dueDate && i.dueDate >= startIso && i.dueDate <= endIso,
    ).length;
  }, [allIssues]);

  const teamMetrics = buildTeamMetrics({
    allIssues,
    pastDueIssues: pastDue,
    pastDueCount: pastDue.length,
    dueThisWeekCount,
    teamHours: { logged: teamLogged, target: TEAM_HOURS_TARGET },
    teamHoursWeekLabel: week === 0 ? 'this week' : 'last week',
    selectedAssignedTasks: selectedTasks,
    // Routes EVERY team-scoped card through the picker. Unassigned tasks
    // stay global on purpose — see buildTeamMetrics for rationale.
    selectedUserIds: selectedTeamIds,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-ink-muted">
          Your team at a glance. Your own tasks and hours live under Tasks and Hours.
        </p>
      </div>

      <div className="flex items-center gap-4 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            data-testid={`dashboard-tab-${t}`}
            className={
              'px-1 py-2 text-sm font-medium ' +
              (tab === t
                ? 'border-b-2 border-brand-500 text-ink'
                : 'text-ink-muted hover:text-ink')
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Team' && (
        <MotionConfig reducedMotion="user">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {teamMetrics.map((metric) =>
              metric.id === 'team-engineers' ? (
                <EngineersOutCard
                  key={metric.id}
                  outCount={outCount}
                  total={Number(metric.value)}
                  onSelect={() => setTimeOffOpen(true)}
                />
              ) : (
                <DashboardCard key={metric.id} metric={metric} />
              ),
            )}
          </div>
          <TeamWorkPanel
            week={week}
            onWeekChange={setWeek}
            onSelectedHoursChange={setTeamLogged}
            onSelectedTasksChange={setSelectedTasks}
          />

          <AnimatePresence>
            {timeOffOpen && <TimeOffDetail onClose={() => setTimeOffOpen(false)} />}
          </AnimatePresence>
        </MotionConfig>
      )}

      {tab === 'Project Health' && <DashboardProjectHealth />}

      {tab === 'Resource Planning' && <DashboardResourcePlanning />}
    </div>
  );
}
