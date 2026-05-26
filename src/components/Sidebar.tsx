import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FolderKanban,
  Home,
  LayoutDashboard,
  Library,
  ListTodo,
  Settings,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { useSession } from '../hooks/useSession';

/**
 * Primary navigation rail. Top-level destinations live in `links`; an item
 * may carry `children` to render an expandable sub-menu (CR #15 — "All
 * Projects" is now a sub-link of "Projects"). When the rail is collapsed to
 * icon-only, sub-links are hidden; expanding the rail reveals them.
 */
interface SubLink {
  to: string;
  label: string;
}

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Exact-match highlight (so a parent route doesn't light up on children). */
  end?: boolean;
  children?: SubLink[];
}

const links: NavItem[] = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tasks', label: 'Tasks', icon: ListTodo },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/hours', label: 'Hours', icon: Timer },
  { to: '/directory', label: 'Directory', icon: Library },
  {
    to: '/projects',
    label: 'Projects',
    icon: FolderKanban,
    end: true,
    children: [{ to: '/projects/all', label: 'All Projects' }],
  },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const GROUP_STATE_KEY = 'rod.sidebar.groups';

function loadGroupState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(GROUP_STATE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

const itemClass = (collapsed: boolean, isActive: boolean) =>
  clsx(
    'flex items-center gap-2 rounded-lg transition text-sm font-medium',
    collapsed ? 'h-10 w-10 justify-center mx-auto' : 'h-9 px-2',
    isActive ? 'sidebar-link-active' : 'sidebar-link',
  );

export default function Sidebar({ collapsed, onToggle }: Props) {
  const { user, adminDisabled } = useSession();
  const showAdmin = !adminDisabled && Boolean(user);
  const [groups, setGroups] = useState<Record<string, boolean>>(loadGroupState);

  // Default a group to open unless the user has explicitly collapsed it.
  const isGroupOpen = (key: string) => groups[key] ?? true;

  const toggleGroup = (key: string) => {
    setGroups((prev) => {
      const next = { ...prev, [key]: !(prev[key] ?? true) };
      try {
        localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(next));
      } catch {
        /* ignore persistence failures */
      }
      return next;
    });
  };

  return (
    <aside
      data-testid="primary-sidebar"
      data-collapsed={collapsed}
      style={{
        backgroundColor: 'var(--brand-surface)',
        color: 'var(--brand-surface-text)',
        minHeight: 'calc(100vh - 3.5rem)',
        maxHeight: 'calc(100vh - 3.5rem)',
      }}
      className={clsx(
        'shrink-0 flex flex-col py-3 gap-1 border-r overflow-y-auto z-40',
        'fixed top-14 left-0 md:sticky md:top-14 md:self-start',
        'transition-transform md:transition-[width,transform] duration-150',
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

      {links.map((item) => {
        const { to, label, icon: Icon, end, children } = item;
        const hasChildren = Boolean(children?.length);
        const showChildren = hasChildren && !collapsed && isGroupOpen(to);

        // Plain item (no children, or collapsed rail hides sub-links).
        if (!hasChildren || collapsed) {
          return (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              end={end}
              className={({ isActive }) => itemClass(collapsed, isActive)}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          );
        }

        // Expandable group: parent link + chevron toggle, then sub-links.
        const panelId = `sidebar-group-${to.replace(/\//g, '-')}`;
        return (
          <div key={to}>
            <div className="flex items-center gap-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx(itemClass(collapsed, isActive), 'flex-1')
                }
              >
                <Icon size={18} className="shrink-0" />
                <span className="truncate">{label}</span>
              </NavLink>
              <button
                type="button"
                onClick={() => toggleGroup(to)}
                aria-label={`${isGroupOpen(to) ? 'Collapse' : 'Expand'} ${label} menu`}
                aria-expanded={isGroupOpen(to)}
                aria-controls={panelId}
                data-testid={`sidebar-group-toggle-${label.toLowerCase()}`}
                className="p-1 rounded transition sidebar-link"
              >
                <ChevronDown
                  size={14}
                  className={clsx('transition-transform', !isGroupOpen(to) && '-rotate-90')}
                />
              </button>
            </div>
            {showChildren && (
              <div id={panelId} role="group" aria-label={`${label} links`} className="mt-1 ml-3 flex flex-col gap-1 border-l border-white/10 pl-2">
                {children!.map((child) => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    className={({ isActive }) => itemClass(false, isActive)}
                  >
                    <span className="truncate">{child.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {showAdmin && (
        <NavLink
          to="/admin"
          title={collapsed ? 'Admin' : undefined}
          data-testid="sidebar-admin-link"
          className={({ isActive }) => itemClass(collapsed, isActive)}
        >
          <ShieldCheck size={18} className="shrink-0" />
          {!collapsed && <span className="truncate">Admin</span>}
        </NavLink>
      )}
    </aside>
  );
}
