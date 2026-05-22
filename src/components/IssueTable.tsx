import { useMemo, useState } from 'react';
import {
  Download,
  Edit3,
  ExternalLink,
  Filter,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import type { Issue } from '../types/redmine';
import { MOCK_TODAY, daysOverdue, formatDate, formatHours, isOverdue, statusPill } from '../lib/format';
import PriorityPill from './PriorityPill';
import ProgressBar from './ProgressBar';

interface Props {
  title: string;
  issues: Issue[];
  showDaysOverdue?: boolean;
  onOpenIssue?: (issue: Issue) => void;
  onQuickEdit?: (issue: Issue) => void;
  onRefresh?: () => void;
  onExport?: () => void;
  loading?: boolean;
}

type SortKey =
  | 'id'
  | 'subject'
  | 'project'
  | 'status'
  | 'priority'
  | 'assignee'
  | 'startDate'
  | 'dueDate'
  | 'spentHours'
  | 'estimatedHours'
  | 'doneRatio'
  | 'daysOverdue';

export default function IssueTable({
  title,
  issues,
  showDaysOverdue,
  onOpenIssue,
  onQuickEdit,
  onRefresh,
  onExport,
  loading,
}: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>(showDaysOverdue ? 'daysOverdue' : 'id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(showDaysOverdue ? 'desc' : 'asc');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = issues;
    if (q) {
      rows = rows.filter((i) =>
        [i.subject, i.projectName, i.assignee?.name ?? '', `${i.id}`, i.status, i.priority]
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }
    const sorted = [...rows].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [issues, query, sortKey, sortDir]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((i) => i.id)));
    }
  };

  const headerCell = (label: string, key: SortKey) => (
    <th
      className="px-2 py-2 cursor-pointer select-none"
      onClick={() => {
        if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        else {
          setSortKey(key);
          setSortDir('asc');
        }
      }}
    >
      <span className={clsx('inline-flex items-center gap-1', sortKey === key && 'text-ink')}>
        {label}
        {sortKey === key && <span className="text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </th>
  );

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100">
        <div>
          <div className="font-semibold text-ink">{title}</div>
          <div className="text-xs text-ink-muted">
            Showing {filtered.length} of {issues.length}
            {selected.size > 0 && ` · ${selected.size} selected`}
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 px-2 py-1 bg-canvas rounded-md border border-gray-200">
          <Search size={14} className="text-ink-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent outline-none text-sm w-56"
            placeholder="Search this table"
            aria-label={`Search ${title}`}
          />
        </div>
        <button className="btn-ghost" aria-label="Filter">
          <Filter size={14} /> Filter
        </button>
        <button className="btn-secondary" onClick={onRefresh} aria-label="Refresh">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
        <button className="btn-secondary" onClick={onExport} aria-label="Export">
          <Download size={14} /> Export
        </button>
        {selected.size > 0 && (
          <button className="btn-brand">
            <Edit3 size={14} /> Bulk update ({selected.size})
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-ink-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="px-2 py-2 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </th>
              {headerCell('ID', 'id')}
              {headerCell('Subject', 'subject')}
              {headerCell('Project', 'project')}
              {headerCell('Status', 'status')}
              {headerCell('Priority', 'priority')}
              {headerCell('Assignee', 'assignee')}
              {headerCell('Start', 'startDate')}
              {headerCell('Due', 'dueDate')}
              {showDaysOverdue && headerCell('Days Overdue', 'daysOverdue')}
              {headerCell('Spent', 'spentHours')}
              {headerCell('Est.', 'estimatedHours')}
              {headerCell('% Done', 'doneRatio')}
              <th className="px-2 py-2">Next action</th>
              <th className="px-2 py-2 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => {
              const overdue = isOverdue(i.dueDate, MOCK_TODAY);
              const overdueDays = daysOverdue(i.dueDate, MOCK_TODAY);
              const highPriority = i.priority === 'Urgent' || i.priority === 'Immediate';
              return (
                <tr
                  key={i.id}
                  className={clsx(
                    'border-t border-gray-100 hover:bg-canvas/60',
                    highPriority && 'bg-red-50/40',
                  )}
                >
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(i.id)}
                      onChange={() => toggleSelect(i.id)}
                      aria-label={`Select issue ${i.id}`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button className="link" onClick={() => onOpenIssue?.(i)}>
                      #{i.id}
                    </button>
                  </td>
                  <td className="px-2 py-2 max-w-[280px]">
                    <button
                      className="link text-left"
                      onClick={() => onOpenIssue?.(i)}
                      title={i.subject}
                    >
                      <span className="truncate inline-block max-w-[260px] align-bottom">
                        {i.subject}
                      </span>
                    </button>
                  </td>
                  <td className="px-2 py-2 text-ink-soft">{i.projectName}</td>
                  <td className="px-2 py-2"><span className={statusPill(i.status)}>{i.status}</span></td>
                  <td className="px-2 py-2"><PriorityPill priority={i.priority} /></td>
                  <td className="px-2 py-2 text-ink-soft">{i.assignee?.name ?? '—'}</td>
                  <td className="px-2 py-2 text-ink-soft">{formatDate(i.startDate)}</td>
                  <td className={clsx('px-2 py-2', overdue ? 'text-red-600 font-medium' : 'text-ink-soft')}>
                    {formatDate(i.dueDate)}
                  </td>
                  {showDaysOverdue && (
                    <td className="px-2 py-2">
                      {overdueDays > 0 ? (
                        <span className="pill-red">{overdueDays}d</span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-2 py-2 text-ink-soft">{formatHours(i.spentHours)}</td>
                  <td className="px-2 py-2 text-ink-soft">{formatHours(i.estimatedHours)}</td>
                  <td className="px-2 py-2 text-ink-soft">
                    <ProgressBar value={i.doneRatio} ariaLabel={`${i.doneRatio}% done`} />
                  </td>
                  <td className="px-2 py-2 text-ink-soft truncate max-w-[240px]">
                    {i.nextAction ?? '—'}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        className="p-1 rounded hover:bg-gray-100"
                        title="Quick edit"
                        aria-label={`Quick edit issue ${i.id}`}
                        onClick={() => onQuickEdit?.(i)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="p-1 rounded hover:bg-gray-100"
                        title="Open"
                        aria-label={`Open issue ${i.id}`}
                        onClick={() => onOpenIssue?.(i)}
                      >
                        <ExternalLink size={14} />
                      </button>
                      <button
                        className="p-1 rounded hover:bg-gray-100"
                        title="Delete (placeholder)"
                        aria-label={`Delete issue ${i.id}`}
                      >
                        <Trash2 size={14} />
                      </button>
                      <button className="p-1 rounded hover:bg-gray-100" title="More">
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={showDaysOverdue ? 15 : 14} className="py-10 text-center text-ink-muted">
                  No issues match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function sortValue(i: Issue, key: SortKey): string | number {
  switch (key) {
    case 'id': return i.id;
    case 'subject': return i.subject.toLowerCase();
    case 'project': return i.projectName.toLowerCase();
    case 'status': return i.status;
    case 'priority': {
      const order = ['Low', 'Normal', 'High', 'Urgent', 'Immediate'];
      return order.indexOf(i.priority);
    }
    case 'assignee': return i.assignee?.name.toLowerCase() ?? '';
    case 'startDate': return i.startDate ?? '';
    case 'dueDate': return i.dueDate ?? '';
    case 'spentHours': return i.spentHours;
    case 'estimatedHours': return i.estimatedHours ?? 0;
    case 'doneRatio': return i.doneRatio;
    case 'daysOverdue': return daysOverdue(i.dueDate, MOCK_TODAY);
    default: return 0;
  }
}
