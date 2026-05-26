import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Printer, Save, Settings as SettingsIcon } from 'lucide-react';
import clsx from 'clsx';
import type { Issue, ResourceAllocation, User } from '../types/redmine';
import { formatHours, today as todayFn } from '../lib/format';

interface Props {
  users: User[];
  issues: Issue[];
  allocations: ResourceAllocation[];
  startDate?: string;
  days?: number;
}

type Zoom = 'Day' | 'Week' | 'Month' | 'Quarter' | 'Year';

const ZOOMS: Zoom[] = ['Day', 'Week', 'Month', 'Quarter', 'Year'];

export default function ResourceTimeline({
  users,
  issues,
  allocations,
  startDate = '2026-05-18',
  days = 21,
}: Props) {
  const [zoom, setZoom] = useState<Zoom>('Week');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 1: true });

  const today = useMemo(() => todayFn(), []);
  // Memoize `start` so its identity is stable across renders; without this
  // the `dates` memo would invalidate on every render because `new Date()`
  // produces a fresh object each pass.
  const start = useMemo(() => new Date(startDate), [startDate]);
  const dates = useMemo(() => {
    return Array.from({ length: days }, (_, idx) => {
      const d = new Date(start);
      d.setDate(start.getDate() + idx);
      return d;
    });
  }, [start, days]);

  const totalWidth = dates.length * 36;

  const grouped = useMemo(() => {
    return users.map((u) => {
      const userIssues = issues.filter((i) => i.assignee?.id === u.id);
      const userAllocs = allocations.filter((a) => a.userId === u.id);
      return { user: u, issues: userIssues, allocations: userAllocs };
    });
  }, [users, issues, allocations]);

  const dayIndex = (date: Date) => {
    const diff = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3 border-b">
        <div className="font-semibold">Resource allocation</div>
        <div className="ml-4 flex bg-canvas rounded p-0.5 text-xs">
          {ZOOMS.map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={clsx(
                'px-2 py-1 rounded',
                zoom === z ? 'bg-white shadow-sm font-medium' : 'text-ink-muted',
              )}
            >
              {z}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button className="btn-ghost"><SettingsIcon size={14} /> Tools</button>
        <button className="btn-secondary"><Printer size={14} /> Print</button>
        <button className="btn-brand"><Save size={14} /> Save layout</button>
      </div>

      <div className="flex">
        {/* Left task hierarchy */}
        <div className="w-[420px] shrink-0 border-r border-gray-100">
          <div className="grid grid-cols-[1fr_70px_70px_70px] bg-canvas text-xs uppercase tracking-wide text-ink-muted">
            <div className="px-3 py-2">Subject / Name</div>
            <div className="px-2 py-2">Priority</div>
            <div className="px-2 py-2">Est.</div>
            <div className="px-2 py-2">Spent</div>
          </div>
          <div>
            {grouped.map(({ user, issues: userIssues }) => {
              const isExpanded = expanded[user.id] ?? false;
              return (
                <div key={user.id}>
                  <button
                    className="w-full grid grid-cols-[1fr_70px_70px_70px] text-left text-sm border-t border-gray-100 hover:bg-canvas/70"
                    onClick={() => setExpanded((p) => ({ ...p, [user.id]: !p[user.id] }))}
                  >
                    <div className="px-3 py-2 flex items-center gap-1 font-medium">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      {user.name}
                    </div>
                    <div className="px-2 py-2 text-ink-muted">—</div>
                    <div className="px-2 py-2 text-ink-muted">
                      {formatHours(userIssues.reduce((s, i) => s + (i.estimatedHours ?? 0), 0))}
                    </div>
                    <div className="px-2 py-2 text-ink-muted">
                      {formatHours(userIssues.reduce((s, i) => s + i.spentHours, 0))}
                    </div>
                  </button>
                  {isExpanded &&
                    userIssues.map((i) => (
                      <div
                        key={i.id}
                        className="grid grid-cols-[1fr_70px_70px_70px] text-sm border-t border-gray-100 bg-white"
                      >
                        <div className="pl-8 pr-3 py-2 truncate">
                          <a className="link" href={`#/tasks?id=${i.id}`}>#{i.id}</a>{' '}
                          {i.subject}
                          <div className="text-xs text-ink-muted">{i.projectName}</div>
                        </div>
                        <div className="px-2 py-2 text-ink-soft">{i.priority}</div>
                        <div className="px-2 py-2 text-ink-soft">{formatHours(i.estimatedHours)}</div>
                        <div className="px-2 py-2 text-ink-soft">{formatHours(i.spentHours)}</div>
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right timeline */}
        <div className="flex-1 overflow-x-auto">
          <div style={{ width: totalWidth }}>
            <div
              className="grid bg-canvas text-xs text-ink-muted"
              style={{ gridTemplateColumns: `repeat(${dates.length}, 36px)` }}
            >
              {dates.map((d) => (
                <div
                  key={d.toISOString()}
                  className={clsx(
                    'px-1 py-2 text-center border-r border-gray-100',
                    d.getDay() === 0 || d.getDay() === 6 ? 'bg-canvas/70' : '',
                    d.toDateString() === today.toDateString() && 'bg-brand-100 text-ink',
                  )}
                >
                  <div className="text-[10px]">{d.toLocaleDateString(undefined, { weekday: 'short' })[0]}</div>
                  <div>{d.getDate()}</div>
                </div>
              ))}
            </div>

            {grouped.map(({ user, allocations: userAllocs }) => {
              const isExpanded = expanded[user.id] ?? false;
              return (
                <div key={user.id}>
                  <div
                    className="relative border-t border-gray-100 h-10 grid"
                    style={{ gridTemplateColumns: `repeat(${dates.length}, 36px)` }}
                  >
                    {dates.map((d) => (
                      <div
                        key={d.toISOString()}
                        className={clsx(
                          'border-r border-gray-100 h-10',
                          d.toDateString() === today.toDateString() && 'bg-brand-100/40',
                        )}
                      />
                    ))}
                    {userAllocs.map((a) => {
                      const startIdx = dayIndex(new Date(a.startDate));
                      const endIdx = dayIndex(new Date(a.endDate));
                      // Skip allocations without parseable start/end dates
                      // (many real issues lack both) — otherwise left/width
                      // compute to NaN and React warns on the style.
                      if (Number.isNaN(startIdx) || Number.isNaN(endIdx)) return null;
                      const left = Math.max(0, startIdx) * 36 + 2;
                      const width = Math.max(0, endIdx - Math.max(0, startIdx) + 1) * 36 - 4;
                      if (width <= 0) return null;
                      return (
                        <div
                          key={a.id}
                          className={clsx(
                            'absolute top-2 h-6 rounded text-[10px] text-white px-2 flex items-center gap-1 shadow',
                            a.isOverloaded ? 'bg-red-500' : a.allocationType === 'Manual' ? 'bg-purple-500' : 'bg-blue-500',
                          )}
                          style={{ left, width }}
                          title={`${formatHours(a.allocatedHours)} allocated · ${formatHours(a.spentHours)} spent`}
                        >
                          {formatHours(a.allocatedHours)}
                        </div>
                      );
                    })}
                  </div>
                  {isExpanded &&
                    grouped
                      .find((g) => g.user.id === user.id)
                      ?.issues.map((i) => (
                        <div
                          key={`row-${i.id}`}
                          className="border-t border-gray-100 h-10 grid"
                          style={{ gridTemplateColumns: `repeat(${dates.length}, 36px)` }}
                        >
                          {dates.map((d) => (
                            <div
                              key={d.toISOString()}
                              className={clsx(
                                'border-r border-gray-100 h-10',
                                d.toDateString() === today.toDateString() && 'bg-brand-100/30',
                              )}
                            />
                          ))}
                        </div>
                      ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
