import {
  Activity,
  AlarmClock,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Hammer,
  Settings as SettingsIcon,
  Timer,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardCard from '../components/DashboardCard';
import RecentlyOpenedGrid from '../components/RecentlyOpenedGrid';
import type { RecentItem } from '../components/RecentlyOpenedGrid';
import type { Issue } from '../types/redmine';
import {
  getIssues,
  getMyIssues,
  getPastDueIssues,
  getTeamHours,
  getWeeklyHours,
} from '../services/redmineApi';
import { buildDashboardMetrics, currentMockUser } from '../data/mockData';

const recentlyOpenedWorkspaces: RecentItem[] = [
  { id: 'my-tasks', title: 'My Tasks', type: 'Workspace', description: 'Assigned task queue.', to: '/tasks' },
  { id: 'past-due', title: 'Past Due', type: 'Risk view', description: 'Overdue and blocked work.', to: '/past-due' },
  { id: 'calendar', title: 'Calendar', type: 'Schedule', description: 'Due dates across the month.', to: '/calendar' },
  { id: 'hours-me', title: 'My Hours', type: 'Timesheet', description: 'Weekly entries and totals.', to: '/hours/me' },
  { id: 'resources', title: 'Resource Planner', type: 'Planning', description: 'Team allocation timeline.', to: '/resources' },
  { id: 'project-builder', title: 'Project Builder', type: 'Builder', description: 'Project and task scaffolding.', to: '/project-builder' },
  { id: 'reports', title: 'KPI Tracker', type: 'Reports', description: 'Quarterly KPI status.', to: '/reports?tab=kpi' },
  { id: 'settings', title: 'API Settings', type: 'Admin', description: 'Connection setup.', to: '/settings' },
];

interface ToolCard {
  title: string;
  type: string;
  description: string;
  to: string;
  icon: ReactNode;
}

const tools: ToolCard[] = [
  { title: 'My Tasks', type: 'Workspace', description: 'Issues assigned to you across all projects.', to: '/tasks', icon: <ClipboardList size={20} /> },
  { title: 'Past Due Tasks', type: 'Workspace', description: 'Overdue tickets the team needs to triage.', to: '/past-due', icon: <AlarmClock size={20} /> },
  { title: 'Resource Planner', type: 'Tool', description: 'Allocate engineers across projects.', to: '/resources', icon: <Users size={20} /> },
  { title: 'Time Tracking', type: 'Tool', description: 'Log and review hours by user and project.', to: '/hours', icon: <Timer size={20} /> },
  { title: 'Project Builder', type: 'Tool', description: 'Compose project + task hierarchy before pushing to Redmine.', to: '/project-builder', icon: <Hammer size={20} /> },
  { title: 'KPI Tracker', type: 'Workspace', description: 'Quarterly KPI progress and milestones.', to: '/reports?tab=kpi', icon: <BarChart3 size={20} /> },
  { title: 'Reports', type: 'Workspace', description: 'Weekly time, issue throughput, and project health reports.', to: '/reports', icon: <Activity size={20} /> },
  { title: 'Calendar', type: 'Tool', description: 'Due dates across the month.', to: '/calendar', icon: <CalendarDays size={20} /> },
  { title: 'API Settings', type: 'Configuration', description: 'Connect to your Redmine instance.', to: '/settings', icon: <SettingsIcon size={20} /> },
];

// Subset of dashboard metric ids to surface as the headline row on Home.
const HOME_METRIC_IDS = new Set([
  'tasks-assigned',
  'past-due',
  'hours-week',
  'team-hours-week',
]);

export default function Home() {
  const navigate = useNavigate();
  const [myIssues, setMyIssues] = useState<Issue[]>([]);
  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [pastDue, setPastDue] = useState<Issue[]>([]);
  const [weekly, setWeekly] = useState({ logged: 0, target: 40 });
  const [team, setTeam] = useState({ logged: 0, target: 360 });

  useEffect(() => {
    (async () => {
      const [m, a, pd, w, t] = await Promise.all([
        getMyIssues(currentMockUser.id),
        getIssues(),
        getPastDueIssues(),
        getWeeklyHours(),
        getTeamHours(),
      ]);
      setMyIssues(m);
      setAllIssues(a);
      setPastDue(pd);
      setWeekly(w);
      setTeam(t);
    })();
  }, []);

  const headlineMetrics = buildDashboardMetrics({
    myIssues,
    allIssues,
    pastDueCount: pastDue.length,
    weeklyHours: weekly,
    teamHours: team,
  }).filter((m) => HOME_METRIC_IDS.has(m.id));

  return (
    <div className="space-y-6">
      <section
        data-testid="home-hero"
        className="rounded-2xl p-6 text-white shadow-card"
        style={{
          background:
            'linear-gradient(to right, var(--hero-from), var(--hero-to))',
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-brand">Welcome back,</p>
            <h1 className="text-3xl font-semibold mt-1">{currentMockUser.name}</h1>
            <p className="text-sm text-white/70 mt-1 max-w-lg">
              Here's your operational view across projects, tasks, and the team. Pick up
              where you left off below, or jump straight into the dashboard.
            </p>
          </div>
          <label className="text-sm">
            <span className="sr-only">Active workspace</span>
            <select
              defaultValue="ops"
              aria-label="Active workspace"
              className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
              <option value="ops">Service Operations Workspace</option>
              <option value="eng">Engineering Workspace</option>
            </select>
          </label>
        </div>
      </section>

      <section data-testid="home-headline-metrics">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {headlineMetrics.map((metric) => (
            <DashboardCard key={metric.id} metric={metric} />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between mb-3">
          <h2 className="text-lg font-semibold">Recently opened workspaces</h2>
          <a className="link text-sm" href="#/dashboard">View all</a>
        </div>
        <RecentlyOpenedGrid items={recentlyOpenedWorkspaces} columns={4} />
      </section>

      <section>
        <div className="flex items-end justify-between mb-3">
          <h2 className="text-lg font-semibold">Tools</h2>
          <a className="link text-sm" href="#/dashboard">View all</a>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {tools.map((c) => (
            <button
              key={c.title}
              onClick={() => navigate(c.to)}
              className="card p-4 text-left hover:shadow-md transition"
            >
              <div className="flex items-center gap-2 text-ink-muted">
                {c.icon}
                <span className="ml-auto text-xs pill-gray">{c.type}</span>
              </div>
              <div className="mt-2 font-medium">{c.title}</div>
              <div className="text-xs text-ink-muted mt-1">{c.description}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
