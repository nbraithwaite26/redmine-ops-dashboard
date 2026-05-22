import { useMemo, useState } from 'react';
import {
  AlarmClock,
  BarChart3,
  ChevronDown,
  ClipboardList,
  FileBarChart,
  Filter,
  FolderKanban,
  Hammer,
  Library,
  Search,
  Settings as SettingsIcon,
  Timer,
  User,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';

interface SecondaryItem {
  label: string;
  to: string;
  icon: LucideIcon;
  hint?: string;
}

const items: SecondaryItem[] = [
  { label: 'My Assigned Work', to: '/my-tasks', icon: User, hint: 'Issues assigned to you' },
  { label: 'Past Due Tasks', to: '/past-due', icon: AlarmClock, hint: 'Overdue across the team' },
  { label: 'Project Portfolio', to: '/projects', icon: FolderKanban, hint: 'All active projects' },
  { label: 'Resource Planning', to: '/resources/personal', icon: ClipboardList, hint: 'Your allocations and load' },
  { label: 'Team Workload', to: '/resources/team', icon: Users, hint: 'Team-wide allocation view' },
  { label: 'Time Entries', to: '/time', icon: Timer, hint: 'Weekly time entries' },
  { label: 'Project Builder', to: '/project-builder', icon: Hammer },
  { label: 'KPI Tracker', to: '/reports?tab=kpi', icon: BarChart3, hint: 'Quarterly KPI status' },
  { label: 'Issue Reports', to: '/reports?tab=issues', icon: FileBarChart, hint: 'Throughput and lead time' },
  { label: 'Redmine Directory', to: '/directory', icon: Library },
  { label: 'API Settings', to: '/settings', icon: SettingsIcon },
];

function isItemActive(item: SecondaryItem, pathname: string, search: string): boolean {
  const [itemPath, itemQuery = ''] = item.to.split('?');
  if (itemPath !== pathname) return false;
  if (!itemQuery) {
    return new URLSearchParams(search).get('tab') === null;
  }
  const itemTab = new URLSearchParams(itemQuery).get('tab');
  const currentTab = new URLSearchParams(search).get('tab');
  return itemTab === currentTab;
}

interface Props {
  collapsed?: boolean;
}

export default function SecondaryNav({ collapsed = false }: Props) {
  const [query, setQuery] = useState('');
  const location = useLocation();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.label.toLowerCase().includes(q) || i.hint?.toLowerCase().includes(q),
    );
  }, [query]);

  if (collapsed) {
    return (
      <aside
        data-testid="secondary-nav"
        data-collapsed="true"
        className="w-14 shrink-0 bg-white border-r border-gray-200 flex flex-col py-2 gap-1 items-center"
        aria-label="Workspace navigation"
      >
        {items.map((item) => {
          const active = isItemActive(item, location.pathname, location.search);
          const Icon = item.icon;
          return (
            <Link
              key={`${item.label}-${item.to}`}
              to={item.to}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'h-9 w-9 flex items-center justify-center rounded-md transition',
                active ? 'bg-brand-100 text-ink' : 'text-ink-muted hover:bg-gray-100',
              )}
            >
              <Icon size={16} />
            </Link>
          );
        })}
      </aside>
    );
  }

  return (
    <aside
      data-testid="secondary-nav"
      data-collapsed="false"
      className="w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col"
      aria-label="Workspace navigation"
    >
      <div className="px-3 pt-3 pb-2 border-b border-gray-100">
        <div className="flex items-center justify-between text-xs font-semibold text-ink-muted uppercase tracking-wide">
          <span>Workspaces</span>
          <ChevronDown size={12} />
        </div>
        <div className="mt-2 flex items-center gap-2 px-2 py-1.5 bg-canvas rounded-md border border-gray-200">
          <Search size={14} className="text-ink-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter list"
            className="bg-transparent outline-none text-sm flex-1"
            aria-label="Filter workspace list"
          />
          <Filter size={14} className="text-ink-muted" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {filtered.map((item) => {
          const active = isItemActive(item, location.pathname, location.search);
          return (
            <Link
              key={`${item.label}-${item.to}`}
              to={item.to}
              title={item.hint}
              className={clsx(
                'block text-sm px-3 py-1.5 mx-1 my-0.5 rounded transition',
                active ? 'bg-brand-100 text-ink font-medium' : 'text-ink-soft hover:bg-gray-50',
              )}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-4 py-6 text-sm text-ink-muted">No matches.</div>
        )}
      </div>
      <div className="px-3 py-2 text-xs text-ink-muted border-t border-gray-100">
        {items.length} items
      </div>
    </aside>
  );
}
