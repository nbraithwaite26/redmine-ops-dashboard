import {
  AlarmClock,
  BarChart3,
  CalendarRange,
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
  { to: '/resources', label: 'Resource Management', icon: Users },
  { to: '/time', label: 'Time Tracking', icon: CalendarRange },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/directory', label: 'Directory', icon: Library },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside
      className="bg-brand w-14 shrink-0 flex flex-col items-center py-3 gap-1 border-r border-brand-500/40"
      role="navigation"
      aria-label="Primary navigation"
    >
      <div className="h-8 w-8 rounded bg-ink text-brand flex items-center justify-center font-bold mb-2">
        <ClipboardList size={16} />
      </div>
      {links.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          title={label}
          className={({ isActive }) =>
            clsx(
              'h-10 w-10 flex items-center justify-center rounded-lg transition',
              isActive ? 'bg-ink text-brand' : 'text-ink hover:bg-brand-500/40',
            )
          }
        >
          <Icon size={18} />
        </NavLink>
      ))}
    </aside>
  );
}
