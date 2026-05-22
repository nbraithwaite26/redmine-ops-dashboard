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
import { MOCK_TODAY, daysOverdue } from '../lib/format';
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
    case 'daysOverdue': return daysOverdue(i.dueDate, MOCK_TODAY);
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
    (label: string, key: SortKey) => (
      <th
        className="px-2 py-2 cursor-pointer select-none"
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
      <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100">
        <div>
          <div className="font-semibold text-ink">{title}</div>
          <div className="text-xs text-ink-muted">
            Showing {table.rows.length} of {issues.length}
            {table.selected.size > 0 && ` · ${table.selected.size} selected`}
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 px-2 py-1 bg-canvas rounded-md border border-gray-200">
          <Search size={14} className="text-ink-muted" />
          <input
            value={table.query}
            onChange={(e) => table.setQuery(e.target.value)}
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
