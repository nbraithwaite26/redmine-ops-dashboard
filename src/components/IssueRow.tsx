import {
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import type { Issue } from '../types/redmine';
import {
  daysOverdue,
  formatDate,
  formatHours,
  isOverdue,
  statusPill,
  today,
} from '../lib/format';
import PriorityPill from './PriorityPill';
import ProgressBar from './ProgressBar';

interface Props {
  issue: Issue;
  selected: boolean;
  showDaysOverdue: boolean;
  onToggleSelect: (id: number) => void;
  onOpen?: (issue: Issue) => void;
  onQuickEdit?: (issue: Issue) => void;
}

/**
 * Single row in IssueTable. Extracted in Phase C so the table body's
 * map closure stays tiny and the row's classes/aria are easy to audit.
 */
export default function IssueRow({
  issue,
  selected,
  showDaysOverdue,
  onToggleSelect,
  onOpen,
  onQuickEdit,
}: Props) {
  const now = today();
  const overdue = isOverdue(issue.dueDate, now);
  const overdueDays = daysOverdue(issue.dueDate, now);
  const highPriority = issue.priority === 'Urgent' || issue.priority === 'Immediate';
  return (
    <tr
      className={clsx(
        'border-t border-gray-100 hover:bg-canvas/60',
        highPriority && 'bg-red-50/40',
      )}
    >
      <td className="px-2 py-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(issue.id)}
          aria-label={`Select issue ${issue.id}`}
        />
      </td>
      <td className="px-2 py-2">
        <button className="link" onClick={() => onOpen?.(issue)}>
          #{issue.id}
        </button>
      </td>
      <td className="px-2 py-2 max-w-[280px]">
        <button
          className="link text-left"
          onClick={() => onOpen?.(issue)}
          title={issue.subject}
        >
          <span className="truncate inline-block max-w-[260px] align-bottom">
            {issue.subject}
          </span>
        </button>
      </td>
      <td className="px-2 py-2 text-ink-soft hidden md:table-cell">{issue.projectName}</td>
      <td className="px-2 py-2">
        <span className={statusPill(issue.status)}>{issue.status}</span>
      </td>
      <td className="px-2 py-2">
        <PriorityPill priority={issue.priority} />
      </td>
      <td className="px-2 py-2 text-ink-soft hidden md:table-cell">{issue.assignee?.name ?? '—'}</td>
      <td className="px-2 py-2 text-ink-soft hidden lg:table-cell">{formatDate(issue.startDate)}</td>
      <td
        className={clsx(
          'px-2 py-2',
          overdue ? 'text-red-600 font-medium' : 'text-ink-soft',
        )}
      >
        {formatDate(issue.dueDate)}
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
      <td className="px-2 py-2 text-ink-soft hidden md:table-cell">{formatHours(issue.spentHours)}</td>
      <td className="px-2 py-2 text-ink-soft hidden lg:table-cell">{formatHours(issue.estimatedHours)}</td>
      <td className="px-2 py-2 text-ink-soft hidden md:table-cell">
        <ProgressBar
          value={issue.doneRatio}
          ariaLabel={`${issue.doneRatio}% done`}
        />
      </td>
      <td className="px-2 py-2 text-ink-soft truncate max-w-[240px] hidden lg:table-cell">
        {issue.nextAction ?? '—'}
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1">
          <button
            className="p-1 rounded hover:bg-gray-100"
            title="Quick edit"
            aria-label={`Quick edit issue ${issue.id}`}
            onClick={() => onQuickEdit?.(issue)}
          >
            <Pencil size={14} />
          </button>
          <button
            className="p-1 rounded hover:bg-gray-100"
            title="Open"
            aria-label={`Open issue ${issue.id}`}
            onClick={() => onOpen?.(issue)}
          >
            <ExternalLink size={14} />
          </button>
          <button
            className="p-1 rounded hover:bg-gray-100"
            title="Delete (placeholder)"
            aria-label={`Delete issue ${issue.id}`}
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
}
