import { useEffect, useMemo, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import DashboardCard from '../components/DashboardCard';
import DashboardProjectHealth from '../components/DashboardProjectHealth';
import DashboardResourcePlanning from '../components/DashboardResourcePlanning';
import TeamWorkPanel, { type WeekOffset } from '../components/TeamWorkPanel';
import TimeOffCalendar from '../components/TimeOffCalendar';
import type { Issue, Project } from '../types/redmine';
import { getIssues, getProjects } from '../services/redmineApi';
import { buildTeamMetrics } from '../data/mockData';
import { weekRange } from '../lib/hoursAggregate';
import { today } from '../lib/format';
import { getAllDescendants } from '../lib/projectTree';
import { useAircraftGroupMembers } from '../hooks/useAircraftGroupMembers';

/** Redmine project IDs anchoring the overview's project-scoped metrics. */
const AIRCRAFT_ENGINEERING_ID = 127;
const STCS_ID = 1131;
const CUSTOM_ENGINEERING_SERVICES_ID = 1132;

// Team-first Overview. Personal work (my tasks / my hours) now lives on the
// Tasks and Hours pages, so the Dashboard leads with the team: four headline
// metric cards + the engineer cards in TeamWorkPanel. Project Health and
// Resource Planning remain as secondary tabs.
const TABS = ['Team', 'Project Health', 'Resource Planning'] as const;
type Tab = (typeof TABS)[number];

const TEAM_HOURS_TARGET = 360;

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('Team');
  // Week selection drives the team-hours metric card + the engineer cards
  // in TeamWorkPanel.
  const [week, setWeek] = useState<WeekOffset>(0);
  const range = useMemo(() => weekRange(week), [week]);

  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamLogged, setTeamLogged] = useState(0);

  // The full AE Calendar (TimeOffCalendar) is pinned to the "(eng) Aircraft"
  // Redmine group — independent of any team picker, so the calendar always
  // reflects the engineering team's attendance.
  const { memberIds: aircraftMemberIds } = useAircraftGroupMembers();

  // Initial load: projects (for the active-DDP / active-STC counts) and
  // issues (for the projects-due-in-7-days count). No `pastDueIssues` /
  // `selectedTeam` fetches — the 4-card overview doesn't need them.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [issuesResp, projectsResp] = await Promise.all([
        getIssues(),
        getProjects(),
      ]);
      if (cancelled) return;
      setAllIssues(issuesResp);
      setProjects(projectsResp);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Team-hours total is computed by TeamWorkPanel and lifted up here so
  // the metric scopes to the same engineers visible in the picker. Reset
  // to 0 when the week changes so we don't briefly show a stale number
  // from the previous week while TeamWorkPanel re-aggregates.
  useEffect(() => {
    setTeamLogged(0);
  }, [range.from, range.to]);

  // Active DDPs = descendants of "Custom Engineering Services" (1132) with
  // status === "Active". Tree walk handles arbitrary nesting depth.
  const activeDdpCount = useMemo(() => {
    return getAllDescendants(projects, CUSTOM_ENGINEERING_SERVICES_ID).filter(
      (p) => p.status === 'Active',
    ).length;
  }, [projects]);

  // Active STC projects = descendants of "STCs" (1131) with status "Active".
  const activeStcCount = useMemo(() => {
    return getAllDescendants(projects, STCS_ID).filter((p) => p.status === 'Active').length;
  }, [projects]);

  // Projects due in the next 7 days, scoped to AIRCRAFT ENGINEERING:
  // distinct projectIds of open issues with dueDate in [today, today+7].
  const projectsDueIn7DaysCount = useMemo(() => {
    if (projects.length === 0 || allIssues.length === 0) return 0;
    const aeDescendants = new Set(
      getAllDescendants(projects, AIRCRAFT_ENGINEERING_ID).map((p) => p.id),
    );
    if (aeDescendants.size === 0) return 0;
    const start = today();
    const startIso = start.toISOString().slice(0, 10);
    const endDate = new Date(start);
    endDate.setDate(start.getDate() + 7);
    const endIso = endDate.toISOString().slice(0, 10);
    const projectIds = new Set<number>();
    for (const issue of allIssues) {
      if (issue.closedOn) continue;
      if (!issue.dueDate) continue;
      if (issue.dueDate < startIso || issue.dueDate > endIso) continue;
      if (!aeDescendants.has(issue.projectId)) continue;
      projectIds.add(issue.projectId);
    }
    return projectIds.size;
  }, [projects, allIssues]);

  const teamMetrics = buildTeamMetrics({
    activeDdpCount,
    activeStcCount,
    projectsDueIn7DaysCount,
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
        <MotionConfig reducedMotion="user">
          {/* Exactly four overview cards, one row on xl. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {teamMetrics.map((metric) => (
              <DashboardCard key={metric.id} metric={metric} />
            ))}
          </div>

          {/* Full AE Calendar — live time-off + attendance scoped to the
              (eng) Aircraft group. Sits between the headline cards and the
              engineer panel. */}
          <TimeOffCalendar memberIds={aircraftMemberIds} />

          <TeamWorkPanel
            week={week}
            onWeekChange={setWeek}
            onSelectedHoursChange={setTeamLogged}
          />
        </MotionConfig>
      )}

      {tab === 'Project Health' && <DashboardProjectHealth />}

      {tab === 'Resource Planning' && <DashboardResourcePlanning />}
    </div>
  );
}
