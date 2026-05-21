import {
  Activity,
  AlarmClock,
  BarChart3,
  Bookmark,
  ClipboardList,
  FolderKanban,
  Hammer,
  LayoutDashboard,
  Settings as SettingsIcon,
  Timer,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { currentMockUser } from '../data/mockData';

interface QuickAccess {
  title: string;
  type: string;
  description: string;
  to: string;
  icon: ReactNode;
}

const cards: QuickAccess[] = [
  { title: 'My Tasks', type: 'Workspace', description: 'Issues assigned to you across all projects.', to: '/my-tasks', icon: <ClipboardList size={20} /> },
  { title: 'Past Due Tasks', type: 'Workspace', description: 'Overdue tickets the team needs to triage.', to: '/past-due', icon: <AlarmClock size={20} /> },
  { title: 'Resource Planner', type: 'Tool', description: 'Allocate engineers across projects.', to: '/resources', icon: <Users size={20} /> },
  { title: 'Time Tracking', type: 'Tool', description: 'Log and review hours by user and project.', to: '/time', icon: <Timer size={20} /> },
  { title: 'Project Builder', type: 'Tool', description: 'Compose project + task hierarchy before pushing to Redmine.', to: '/project-builder', icon: <Hammer size={20} /> },
  { title: 'KPI Tracker', type: 'Workspace', description: 'Quarterly KPI progress and milestones.', to: '/reports', icon: <BarChart3 size={20} /> },
  { title: 'Reports', type: 'Workspace', description: 'Weekly time, issue throughput, and project health reports.', to: '/reports', icon: <Activity size={20} /> },
  { title: 'API Settings', type: 'Configuration', description: 'Connect to your Redmine instance.', to: '/settings', icon: <SettingsIcon size={20} /> },
];

const recentApps = [
  { name: 'My Tasks', to: '/my-tasks', kind: 'Workspace', icon: <ClipboardList size={20} /> },
  { name: 'Time Tracking', to: '/time', kind: 'Tool', icon: <Timer size={20} /> },
  { name: 'Resource Planner', to: '/resources', kind: 'Tool', icon: <Users size={20} /> },
  { name: 'Project Builder', to: '/project-builder', kind: 'Tool', icon: <Hammer size={20} /> },
  { name: 'KPI Tracker', to: '/reports', kind: 'Workspace', icon: <BarChart3 size={20} /> },
  { name: 'Dashboard', to: '/dashboard', kind: 'Workspace', icon: <LayoutDashboard size={20} /> },
];

const recentFiles = [
  { name: 'Aircraft Retrofit Planning', kind: 'Project', icon: <FolderKanban size={18} /> },
  { name: 'Customer Support Requests', kind: 'Project', icon: <FolderKanban size={18} /> },
  { name: 'Weekly Hours Report', kind: 'Report', icon: <Activity size={18} /> },
  { name: 'KPI Tracker — Q2', kind: 'Workspace', icon: <BarChart3 size={18} /> },
  { name: 'API Settings', kind: 'Config', icon: <SettingsIcon size={18} /> },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-ink to-ink-soft text-white px-8 py-10 relative overflow-hidden">
        <div className="text-sm text-brand">Welcome back,</div>
        <div className="text-3xl font-semibold mt-1">{currentMockUser.name}</div>
        <div className="text-sm text-white/70 mt-1">
          Here's your operational view across projects, tasks, and the team.
        </div>
        <div className="mt-4 flex bg-white/10 rounded-full px-3 py-2 w-[520px] max-w-full">
          <input
            className="bg-transparent outline-none flex-1 placeholder:text-white/60 text-sm text-white"
            placeholder="Search projects, issues, people…"
          />
          <button className="text-xs text-brand">Activate code search</button>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between mb-3">
          <h2 className="text-lg font-semibold">Recently opened files</h2>
          <a className="link text-sm" href="#/projects">View all</a>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {recentFiles.map((f) => (
            <div key={f.name} className="card p-3 hover:shadow-md transition">
              <div className="flex items-center gap-2 text-ink-muted">
                {f.icon}
                <button className="ml-auto text-ink-muted hover:text-ink" aria-label="Bookmark">
                  <Bookmark size={14} />
                </button>
              </div>
              <div className="mt-2 font-medium truncate">{f.name}</div>
              <div className="text-xs text-ink-muted">{f.kind}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between mb-3">
          <h2 className="text-lg font-semibold">Recently opened workspaces</h2>
          <a className="link text-sm" href="#/dashboard">View all</a>
        </div>
        <div className="grid grid-cols-6 gap-3">
          {recentApps.map((a) => (
            <button
              key={a.name}
              onClick={() => navigate(a.to)}
              className="card p-3 text-left hover:shadow-md transition"
            >
              <div className="flex items-center gap-2 text-ink-muted">
                {a.icon}
                <Bookmark size={14} className="ml-auto" />
              </div>
              <div className="mt-2 font-medium truncate">{a.name}</div>
              <div className="text-xs text-ink-muted">{a.kind}</div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between mb-3">
          <h2 className="text-lg font-semibold">Tools</h2>
          <a className="link text-sm" href="#/dashboard">View all</a>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {cards.map((c) => (
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
