import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import type { Issue, TimeEntry, User } from '../types/redmine';
import { formatHours, statusPill } from '../lib/format';

interface Props {
  /** Title shown above the table. */
  title: string;
  /** Users to group rows by; one group per user (issues with no assignee
   *  fall into an "Unassigned" group). */
  users: User[];
  issues: Issue[];
  /** Optional time entries used to compute weekly hours per user. */
  timeEntries?: TimeEntry[];
  /** Empty-state message when no issues match. */
  emptyMessage?: string;
}

interface Group {
  key: string;
  label: string;
  hours: number;
  percent: number;
  issues: Issue[];
}

/**
 * Two-level table: clickable group rows show user-level totals; expanded
 * groups show individual issues underneath.
 */
export default function GroupedTaskTable({
  title,
  users,
  issues,
  timeEntries = [],
  emptyMessage = 'No issues',
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const groups = useMemo<Group[]>(() => {
    const groupedIssues = new Map<string, Issue[]>();
    const groupedHours = new Map<string, number>();

    users.forEach((u) => {
      groupedIssues.set(u.login, []);
      groupedHours.set(u.login, 0);
    });
    groupedIssues.set('__unassigned__', []);

    issues.forEach((i) => {
      const key = i.assignee?.login ?? '__unassigned__';
      if (!groupedIssues.has(key)) groupedIssues.set(key, []);
      groupedIssues.get(key)!.push(i);
    });

    timeEntries.forEach((t) => {
      const key = t.user.login;
      groupedHours.set(key, (groupedHours.get(key) ?? 0) + t.hours);
    });

    const totalHours = Array.from(groupedHours.values()).reduce((s, h) => s + h, 0);

    const list: Group[] = [];
    users.forEach((u) => {
      const userIssues = groupedIssues.get(u.login) ?? [];
      const hours = groupedHours.get(u.login) ?? 0;
      if (userIssues.length === 0 && hours === 0) return;
      list.push({
        key: u.login,
        label: u.name,
        hours,
        percent: totalHours > 0 ? Math.round((hours / totalHours) * 100) : 0,
        issues: userIssues,
      });
    });

    const unassigned = groupedIssues.get('__unassigned__') ?? [];
    if (unassigned.length > 0) {
      list.push({
        key: '__unassigned__',
        label: 'Unassigned',
        hours: 0,
        percent: 0,
        issues: unassigned,
      });
    }
    return list;
  }, [users, issues, timeEntries]);

  const totalHours = groups.reduce((s, g) => s + g.hours, 0);
  const totalCount = groups.reduce((s, g) => s + g.issues.length, 0);

  const toggle = (key: string) =>
    setExpanded((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div data-testid="grouped-task-table" className="overflow-x-auto">
      <div className="px-4 py-2 border-b border-gray-100 text-sm font-semibold flex items-center gap-2">
        <span>{title}</span>
        <span className="text-ink-muted font-normal">({totalCount})</span>
        <span className="flex-1" />
        <span className="text-ink-muted font-normal">
          Total: <span className="text-ink font-medium">{formatHours(totalHours)}</span>
        </span>
      </div>
      {groups.length === 0 ? (
        <div className="py-6 text-center text-sm text-ink-muted">{emptyMessage}</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-canvas text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-2 py-2 w-8" />
              <th className="px-2 py-2 text-left">User</th>
              <th className="px-2 py-2 text-left">Issues</th>
              <th className="px-2 py-2 text-right">Hours</th>
              <th className="px-2 py-2 text-right">% of total</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const isOpen = expanded[g.key] ?? false;
              return (
                <GroupRows
                  key={g.key}
                  group={g}
                  isOpen={isOpen}
                  onToggle={() => toggle(g.key)}
                />
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function GroupRows({
  group,
  isOpen,
  onToggle,
}: {
  group: Group;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="border-t border-gray-100 hover:bg-canvas/60 cursor-pointer"
        onClick={onToggle}
        data-testid={`group-row-${group.key}`}
      >
        <td className="px-2 py-2">
          <button
            aria-label={isOpen ? `Collapse ${group.label}` : `Expand ${group.label}`}
            className="p-1 rounded hover:bg-gray-100 text-ink-muted"
          >
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </td>
        <td className="px-2 py-2 font-medium">{group.label}</td>
        <td className="px-2 py-2 text-ink-soft">{group.issues.length}</td>
        <td className="px-2 py-2 text-right text-ink-soft">{formatHours(group.hours)}</td>
        <td className="px-2 py-2 text-right text-ink-soft">{group.percent}%</td>
      </tr>
      {isOpen &&
        group.issues.map((i) => (
          <tr
            key={i.id}
            className={clsx('border-t border-gray-50 bg-white/60')}
            data-testid={`issue-row-${i.id}`}
          >
            <td />
            <td className="pl-8 pr-2 py-1.5">
              <a className="link" href={`#/tasks?id=${i.id}`}>#{i.id}</a>{' '}
              <span className="text-ink-soft">{i.subject}</span>
              <div className="text-xs text-ink-muted">{i.projectName}</div>
            </td>
            <td className="px-2 py-1.5">
              <span className={statusPill(i.status)}>{i.status}</span>
            </td>
            <td className="px-2 py-1.5 text-right text-ink-soft">{formatHours(i.spentHours)}</td>
            <td className="px-2 py-1.5 text-right text-ink-soft">
              {i.estimatedHours != null ? formatHours(i.estimatedHours) : '—'}
            </td>
          </tr>
        ))}
    </>
  );
}
