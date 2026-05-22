import {
  AlarmClock,
  BarChart3,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FolderKanban,
  Hammer,
  Home,
  LayoutDashboard,
  Library,
  ListTodo,
  Settings,
  Users,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';

const links = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/my-tasks', label: 'My Tasks', icon: ListTodo },
  { to: '/past-due', label: 'Past Due', icon: AlarmClock },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/project-builder', label: 'Project Builder', icon: Hammer },
  { to: '/resources/team', label: 'Resource Management', icon: Users },
  { to: '/time', label: 'Time Tracking', icon: CalendarRange },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/directory', label: 'Directory', icon: Library },
  { to: '/settings', label: 'Settings', icon: Settings },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: Props) {
  return (
    <aside
      data-testid="primary-sidebar"
      data-collapsed={collapsed}
      className={clsx(
        'bg-brand shrink-0 flex flex-col py-3 gap-1 border-r border-brand-500/40 transition-[width] duration-150',
        collapsed ? 'w-14 items-center' : 'w-52 items-stretch px-2',
      )}
      role="navigation"
      aria-label="Primary navigation"
    >
      <div
        className={clsx(
          'flex items-center mb-2',
          collapsed ? 'justify-center' : 'justify-between px-1',
        )}
      >
        <div className="h-8 w-8 rounded bg-ink text-brand flex items-center justify-center font-bold shrink-0">
          <ClipboardList size={16} />
        </div>
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={collapsed}
          className={clsx(
            'rounded text-ink hover:bg-brand-500/40 transition',
            collapsed ? 'hidden' : 'p-1',
          )}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
      {links.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          title={collapsed ? label : undefined}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-2 rounded-lg transition text-sm font-medium',
              collapsed ? 'h-10 w-10 justify-center mx-auto' : 'h-9 px-2',
              isActive ? 'bg-ink text-brand' : 'text-ink hover:bg-brand-500/40',
            )
          }
        >
          <Icon size={18} className="shrink-0" />
          {!collapsed && <span className="truncate">{label}</span>}
        </NavLink>
      ))}
    </aside>
  );
}
