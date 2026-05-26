import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import type { Issue } from '../types/redmine';
import { isOverdue, priorityPill, today } from '../lib/format';

interface Props {
  issues: Issue[];
  /** Initial month to show. Defaults to mock-mode-aware today(). */
  initialMonth?: Date;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarGrid({ issues, initialMonth }: Props) {
  const todayDate = useMemo(() => today(), []);
  const [month, setMonth] = useState(() => startOfMonth(initialMonth ?? todayDate));

  const cells = useMemo(() => {
    const first = new Date(month);
    const startOffset = first.getDay();
    const start = new Date(first);
    start.setDate(first.getDate() - startOffset);

    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [month]);

  const byDate = useMemo(() => {
    const map = new Map<string, Issue[]>();
    issues.forEach((i) => {
      if (!i.dueDate) return;
      if (!map.has(i.dueDate)) map.set(i.dueDate, []);
      map.get(i.dueDate)!.push(i);
    });
    return map;
  }, [issues]);

  const monthLabel = month.toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div data-testid="calendar-grid" className="card overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2 border-b">
        <button
          aria-label="Previous month"
          onClick={() => setMonth(addMonths(month, -1))}
          className="p-1 rounded hover:bg-gray-100"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="font-semibold">{monthLabel}</div>
        <button
          aria-label="Next month"
          onClick={() => setMonth(addMonths(month, 1))}
          className="p-1 rounded hover:bg-gray-100"
        >
          <ChevronRight size={16} />
        </button>
      </header>
      <div className="grid grid-cols-7 bg-canvas text-xs uppercase tracking-wide text-ink-muted">
        {DAY_LABELS.map((d) => (
          <div key={d} className="px-2 py-1.5 text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const inMonth = d.getMonth() === month.getMonth();
          const iso = d.toISOString().slice(0, 10);
          const dayIssues = byDate.get(iso) ?? [];
          const isToday = iso === todayDate.toISOString().slice(0, 10);
          return (
            <div
              key={iso}
              data-testid={`day-${iso}`}
              className={clsx(
                'border-t border-l first:border-l-0 border-gray-100 min-h-[88px] p-1.5 flex flex-col gap-1',
                !inMonth && 'bg-canvas/40 text-ink-muted',
                isToday && 'bg-brand-100/40',
              )}
            >
              <div className="text-xs font-medium flex items-center justify-between">
                <span>{d.getDate()}</span>
                {dayIssues.length > 0 && (
                  <span className="pill-blue">{dayIssues.length}</span>
                )}
              </div>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayIssues.slice(0, 3).map((i) => (
                  <a
                    key={i.id}
                    href={`#/tasks?id=${i.id}`}
                    className={clsx(
                      'text-[10px] truncate px-1 py-0.5 rounded',
                      isOverdue(i.dueDate, todayDate)
                        ? 'bg-red-50 text-red-800'
                        : 'bg-gray-50 text-ink-soft',
                    )}
                    title={i.subject}
                  >
                    <span className={clsx('mr-1 inline-block w-1.5 h-1.5 rounded-full align-middle', dotColor(i.priority))} />
                    #{i.id} {i.subject}
                  </a>
                ))}
                {dayIssues.length > 3 && (
                  <span className="text-[10px] text-ink-muted">+{dayIssues.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function dotColor(priority: string): string {
  const cls = priorityPill(priority as never);
  if (cls.includes('red')) return 'bg-red-500';
  if (cls.includes('orange')) return 'bg-orange-500';
  if (cls.includes('blue')) return 'bg-blue-500';
  return 'bg-gray-400';
}
