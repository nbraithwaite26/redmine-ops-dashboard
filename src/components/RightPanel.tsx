import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  FileBarChart,
  FolderPlus,
  ListPlus,
  Settings as SettingsIcon,
  Timer,
} from 'lucide-react';

interface Announcement {
  title: string;
  category: string;
  body: string;
  severity: 'info' | 'warn' | 'critical';
}

const announcements: Announcement[] = [
  {
    title: 'Mock mode is active',
    category: 'API',
    body: 'Redmine sync is using mock data. Configure your API connection in Settings.',
    severity: 'info',
  },
  {
    title: '4 tasks are past due',
    category: 'Workload',
    body: 'Review the Past Due Tasks page to triage and reassign.',
    severity: 'warn',
  },
  {
    title: '2 projects need schedule review',
    category: 'Schedule',
    body: 'Certification Review and System Integration have slipped milestones.',
    severity: 'critical',
  },
];

const recentActivity = [
  'Alex updated task #1024',
  'Jordan logged 2.5 hours on #1027',
  'Taylor changed project priority on Customer Support',
  'Casey resolved #1032',
  'Riley created subtask under #1031',
];

export default function RightPanel() {
  return (
    <aside className="w-80 shrink-0 border-l border-gray-200 bg-white flex flex-col" aria-label="Utility panel">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="font-semibold text-ink">Announcements</div>
        <button className="text-xs text-ink-muted hover:text-ink" aria-label="Expand announcements">
          3
        </button>
      </div>
      <div className="px-4 py-3 space-y-3">
        {announcements.map((a) => (
          <div
            key={a.title}
            className="rounded-lg border border-gray-100 p-3 hover:border-gray-200 transition"
          >
            <div className="flex items-center gap-2 text-xs font-medium">
              {a.severity === 'critical' && (
                <span className="pill bg-red-100 text-red-800">
                  <AlertTriangle size={10} className="mr-1" /> Major incident
                </span>
              )}
              {a.severity === 'warn' && (
                <span className="pill-orange">Warning</span>
              )}
              {a.severity === 'info' && <span className="pill-blue">Info</span>}
              <span className="text-ink-muted">· {a.category}</span>
            </div>
            <div className="font-medium mt-1 text-sm">{a.title}</div>
            <div className="text-xs text-ink-muted mt-1">{a.body}</div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-gray-100">
        <div className="font-semibold text-ink mb-2">Upcoming</div>
        <div className="flex border-b border-gray-100 text-sm">
          <button className="px-3 py-1.5 border-b-2 border-brand-500 font-medium">Today</button>
          <button className="px-3 py-1.5 text-ink-muted hover:text-ink">Tomorrow</button>
          <button className="px-3 py-1.5 text-ink-muted hover:text-ink">This Week</button>
        </div>
        <ul className="mt-2 text-sm space-y-1.5">
          <li className="flex items-start gap-2">
            <CalendarDays size={14} className="text-orange-500 mt-0.5" />
            <span>1 task at risk of slipping today</span>
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-red-500 mt-0.5" />
            <span>5 tasks with breached SLA</span>
          </li>
        </ul>
      </div>

      <div className="px-4 py-3 border-t border-gray-100">
        <div className="font-semibold text-ink mb-2 flex items-center justify-between">
          Quick links
          <ChevronDown size={14} className="text-ink-muted" />
        </div>
        <ul className="text-sm space-y-1.5">
          <li><a className="link inline-flex items-center gap-2" href="#/my-tasks"><ListPlus size={14} /> Create New Task</a></li>
          <li><a className="link inline-flex items-center gap-2" href="#/project-builder"><FolderPlus size={14} /> Create New Project</a></li>
          <li><a className="link inline-flex items-center gap-2" href="#/time"><Timer size={14} /> Log Time</a></li>
          <li><a className="link inline-flex items-center gap-2" href="#/resources"><CalendarDays size={14} /> Open Resource Planner</a></li>
          <li><a className="link inline-flex items-center gap-2" href="#/settings"><SettingsIcon size={14} /> Open API Settings</a></li>
          <li><a className="link inline-flex items-center gap-2" href="#/reports"><FileBarChart size={14} /> Export Weekly Report</a></li>
        </ul>
      </div>

      <div className="px-4 py-3 border-t border-gray-100">
        <div className="font-semibold text-ink mb-2">Recent activity</div>
        <ul className="text-sm space-y-1.5 text-ink-soft">
          {recentActivity.map((line) => (
            <li key={line} className="flex items-start gap-2">
              <ExternalLink size={12} className="text-ink-muted mt-1" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
