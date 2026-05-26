import { useCallback } from 'react';
import {
  Download,
  Edit3,
  Filter,
  RefreshCw,
  Search,
} from 'lucide-react';
import clsx from 'clsx';
import type { Issue } from '../types/redmine';
import { daysOverdue, today } from '../lib/format';
import { useTableState } from '../hooks/useTableState';
import IssueRow from './IssueRow';

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

const PRIORITY_ORDER = ['Low', 'Normal', 'High', 'Urgent', 'Immediate'];

function sortValue(i: Issue, key: SortKey): string | number {
  switch (key) {
    case 'id': return i.id;
    case 'subject': return i.subject.toLowerCase();
    case 'project': return i.projectName.toLowerCase();
    case 'status': return i.status;
    case 'priority': return PRIORITY_ORDER.indexOf(i.priority);
    case 'assignee': return i.assignee?.name.toLowerCase() ?? '';
    case 'startDate': return i.startDate ?? '';
    case 'dueDate': return i.dueDate ?? '';
    case 'spentHours': return i.spentHours;
    case 'estimatedHours': return i.estimatedHours ?? 0;
    case 'doneRatio': return i.doneRatio;
    case 'daysOverdue': return daysOverdue(i.dueDate, today());
    default: return 0;
  }
}

function matches(i: Issue, q: string): boolean {
  return [
    i.subject,
    i.projectName,
    i.assignee?.name ?? '',
    `${i.id}`,
    i.status,
    i.priority,
  ]
    .join(' ')
    .toLowerCase()
    .includes(q);
}

export default function IssueTable({
  title,
  issues,
  showDaysOverdue = false,
  onOpenIssue,
  onQuickEdit,
  onRefresh,
  onExport,
  loading,
}: Props) {
  const table = useTableState<Issue, SortKey>({
    rows: issues,
    initialSortKey: showDaysOverdue ? 'daysOverdue' : 'id',
    initialSortDir: showDaysOverdue ? 'desc' : 'asc',
    sortValue,
    matches,
    rowId: (i) => i.id,
  });

  const headerCell = useCallback(
    (label: string, key: SortKey, hideBelow?: 'md' | 'lg') => (
      <th
        className={clsx(
          'px-2 py-2 cursor-pointer select-none',
          hideBelow === 'md' && 'hidden md:table-cell',
          hideBelow === 'lg' && 'hidden lg:table-cell',
        )}
        onClick={() => table.toggleSort(key)}
      >
        <span
          className={clsx(
            'inline-flex items-center gap-1',
            table.sortKey === key && 'text-ink',
          )}
        >
          {label}
          {table.sortKey === key && (
            <span className="text-[10px]">{table.sortDir === 'asc' ? '▲' : '▼'}</span>
          )}
        </span>
      </th>
    ),
    [table],
  );

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-100">
        <div className="min-w-0">
          <div className="font-semibold text-ink truncate">{title}</div>
          <div className="text-xs text-ink-muted">
            Showing {table.rows.length} of {issues.length}
            {table.selected.size > 0 && ` · ${table.selected.size} selected`}
          </div>
        </div>
        <div className="flex-1 min-w-0" />
        <div className="flex items-center gap-2 px-2 py-1 bg-canvas rounded-md border border-gray-200 min-w-0">
          <Search size={14} className="text-ink-muted shrink-0" />
          <input
            value={table.query}
            onChange={(e) => table.setQuery(e.target.value)}
            className="bg-transparent outline-none text-sm w-32 sm:w-56 min-w-0"
            placeholder="Search this table"
            aria-label={`Search ${title}`}
          />
        </div>
        <button className="btn-ghost hidden sm:inline-flex" aria-label="Filter">
          <Filter size={14} /> Filter
        </button>
        <button className="btn-secondary" onClick={onRefresh} aria-label="Refresh">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> <span className="hidden sm:inline">Refresh</span>
        </button>
        <button className="btn-secondary hidden sm:inline-flex" onClick={onExport} aria-label="Export">
          <Download size={14} /> Export
        </button>
        {table.selected.size > 0 && (
          <button className="btn-brand">
            <Edit3 size={14} /> Bulk update ({table.selected.size})
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
                  checked={table.isAllSelected}
                  onChange={
                    table.isAllSelected ? table.clearSelection : table.selectAll
                  }
                  aria-label="Select all"
                />
              </th>
              {headerCell('ID', 'id')}
              {headerCell('Subject', 'subject')}
              {headerCell('Project', 'project', 'md')}
              {headerCell('Status', 'status')}
              {headerCell('Priority', 'priority')}
              {headerCell('Assignee', 'assignee', 'md')}
              {headerCell('Start', 'startDate', 'lg')}
              {headerCell('Due', 'dueDate')}
              {showDaysOverdue && headerCell('Days Overdue', 'daysOverdue')}
              {headerCell('Spent', 'spentHours', 'md')}
              {headerCell('Est.', 'estimatedHours', 'lg')}
              {headerCell('% Done', 'doneRatio', 'md')}
              <th className="px-2 py-2 hidden lg:table-cell">Next action</th>
              <th className="px-2 py-2 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((i) => (
              <IssueRow
                key={i.id}
                issue={i}
                selected={table.selected.has(i.id)}
                showDaysOverdue={showDaysOverdue}
                onToggleSelect={table.toggleSelected}
                onOpen={onOpenIssue}
                onQuickEdit={onQuickEdit}
              />
            ))}
            {table.rows.length === 0 && (
              <tr>
                <td
                  colSpan={showDaysOverdue ? 15 : 14}
                  className="py-10 text-center text-ink-muted"
                >
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
