import { useMemo, useState } from 'react';
import { ChevronDown, Filter, Search } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';

interface SecondaryItem {
  label: string;
  to: string;
  hint?: string;
}

const items: SecondaryItem[] = [
  { label: 'My Assigned Work', to: '/my-tasks', hint: 'Issues assigned to you' },
  { label: 'Past Due Tasks', to: '/past-due', hint: 'Overdue across the team' },
  { label: 'Project Portfolio', to: '/projects', hint: 'All active projects' },
  { label: 'Resource Planning', to: '/resources/personal', hint: 'Your allocations and load' },
  { label: 'Team Workload', to: '/resources/team', hint: 'Team-wide allocation view' },
  { label: 'Time Entries', to: '/time', hint: 'Weekly time entries' },
  { label: 'Project Builder', to: '/project-builder' },
  { label: 'KPI Tracker', to: '/reports?tab=kpi', hint: 'Quarterly KPI status' },
  { label: 'Issue Reports', to: '/reports?tab=issues', hint: 'Throughput and lead time' },
  { label: 'Redmine Directory', to: '/directory' },
  { label: 'API Settings', to: '/settings' },
];

/**
 * Returns whether the workspace item should render as active for the
 * current URL. We use pathname **and** the `tab` query parameter so that
 * KPI Tracker and Issue Reports (both pointing to /reports) can be
 * disambiguated. NavLink's built-in `isActive` ignores the query string,
 * which is why we replace it.
 */
function isItemActive(item: SecondaryItem, pathname: string, search: string): boolean {
  const [itemPath, itemQuery = ''] = item.to.split('?');
  if (itemPath !== pathname) return false;
  if (!itemQuery) {
    // For tab-bearing pages, the unparameterised item should only match
    // when no tab query is present (so we never highlight a "bare" entry
    // alongside a tabbed one for the same path).
    return new URLSearchParams(search).get('tab') === null;
  }
  const itemTab = new URLSearchParams(itemQuery).get('tab');
  const currentTab = new URLSearchParams(search).get('tab');
  return itemTab === currentTab;
}

export default function SecondaryNav() {
  const [query, setQuery] = useState('');
  const location = useLocation();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.label.toLowerCase().includes(q) || i.hint?.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col" aria-label="Workspace navigation">
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
