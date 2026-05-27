import { useEffect, useMemo, useState } from 'react';
import DashboardCard from '../components/DashboardCard';
import DashboardProjectHealth from '../components/DashboardProjectHealth';
import DashboardResourcePlanning from '../components/DashboardResourcePlanning';
import TeamWorkPanel, { type WeekOffset } from '../components/TeamWorkPanel';
import type { Issue } from '../types/redmine';
import { getIssues, getPastDueIssues, getTimeEntries } from '../services/redmineApi';
import { buildTeamMetrics } from '../data/mockData';
import { weekRange } from '../lib/hoursAggregate';
import { today } from '../lib/format';

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

  // Team hours logged in the selected week = sum of all time entries in range.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await getTimeEntries({ from: range.from, to: range.to });
      if (cancelled) return;
      const total = entries.reduce((sum, e) => sum + e.hours, 0);
      setTeamLogged(Math.round(total * 10) / 10);
    })();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

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
    pastDueCount: pastDue.length,
    dueThisWeekCount,
    teamHours: { logged: teamLogged, target: TEAM_HOURS_TARGET },
    teamHoursWeekLabel: week === 0 ? 'this week' : 'last week',
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
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {teamMetrics.map((metric) => (
              <DashboardCard key={metric.id} metric={metric} />
            ))}
          </div>
          <TeamWorkPanel week={week} onWeekChange={setWeek} />
        </>
      )}

      {tab === 'Project Health' && <DashboardProjectHealth />}

      {tab === 'Resource Planning' && <DashboardResourcePlanning />}
    </div>
  );
}
