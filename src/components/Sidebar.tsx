import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FolderKanban,
  FolderTree,
  Home,
  LayoutDashboard,
  Library,
  ListTodo,
  Settings,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { useSession } from '../hooks/useSession';

/**
 * Primary navigation rail. All top-level destinations live here — the
 * white workspaces panel (SecondaryNav) was removed in CR #13 to simplify
 * the chrome. Demoted pages remain reachable via Home → Tools and direct
 * URLs.
 */
const links = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tasks', label: 'Tasks', icon: ListTodo },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/hours', label: 'Hours', icon: Timer },
  { to: '/directory', label: 'Directory', icon: Library },
  { to: '/projects/all', label: 'All Projects', icon: FolderTree },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/settings', label: 'Settings', icon: Settings },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: Props) {
  const { user, adminDisabled } = useSession();
  const showAdmin = !adminDisabled && Boolean(user);
  return (
    <aside
      data-testid="primary-sidebar"
      data-collapsed={collapsed}
      style={{
        backgroundColor: 'var(--brand-surface)',
        color: 'var(--brand-surface-text)',
        // Use inline style for the calc() arbitrary value so we don't
        // depend on Tailwind's arbitrary-value parser handling dashes
        // inside calc(). Sidebar is exactly viewport-minus-TopBar tall
        // so it visually fills the entire screen height when sticky.
        minHeight: 'calc(100vh - 3.5rem)',
        maxHeight: 'calc(100vh - 3.5rem)',
      }}
      className={clsx(
        // Below `md` the rail floats over content (fixed/overlay) so it
        // doesn't steal horizontal space on phones. At `md` and up it
        // returns to the sticky-push layout used on desktop.
        'shrink-0 flex flex-col py-3 gap-1 border-r overflow-y-auto z-40',
        'fixed top-14 left-0 md:sticky md:top-14 md:self-start',
        'transition-transform md:transition-[width,transform] duration-150',
        // Width + visibility states differ by viewport. On mobile the
        // collapsed flag hides the rail entirely (translate it off-screen);
        // on desktop it shrinks to an icon-only rail.
        collapsed
          ? '-translate-x-full w-52 md:translate-x-0 md:w-14 md:items-center'
          : 'translate-x-0 w-52 md:items-stretch md:px-2',
      )}
      role="navigation"
      aria-label="Primary navigation"
    >
      <div
        className={clsx(
          'flex items-center mb-2',
          collapsed ? 'flex-col gap-2' : 'justify-between px-1',
        )}
      >
        <div
          style={{
            backgroundColor: 'var(--brand-active-bg)',
            color: 'var(--brand-active-text)',
          }}
          className="h-8 w-8 rounded flex items-center justify-center font-bold shrink-0"
        >
          <ClipboardList size={16} />
        </div>
        {/* Always-visible popout/collapse button. When collapsed, this is
            the user's only way to bring the rail back without using the
            TopBar toggle. */}
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={collapsed}
          data-testid="sidebar-popout"
          style={{ color: 'var(--brand-surface-text)' }}
          className="p-1 rounded transition hover:bg-[color:var(--brand-surface-hover)]"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
      {links.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          title={collapsed ? label : undefined}
          end={to === '/projects'}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-2 rounded-lg transition text-sm font-medium',
              collapsed ? 'h-10 w-10 justify-center mx-auto' : 'h-9 px-2',
              isActive ? 'sidebar-link-active' : 'sidebar-link',
            )
          }
        >
          <Icon size={18} className="shrink-0" />
          {!collapsed && <span className="truncate">{label}</span>}
        </NavLink>
      ))}
      {showAdmin && (
        <NavLink
          to="/admin"
          title={collapsed ? 'Admin' : undefined}
          data-testid="sidebar-admin-link"
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-2 rounded-lg transition text-sm font-medium',
              collapsed ? 'h-10 w-10 justify-center mx-auto' : 'h-9 px-2',
              isActive ? 'sidebar-link-active' : 'sidebar-link',
            )
          }
        >
          <ShieldCheck size={18} className="shrink-0" />
          {!collapsed && <span className="truncate">Admin</span>}
        </NavLink>
      )}
    </aside>
  );
}
