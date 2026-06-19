import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Printer, Save, Settings as SettingsIcon } from 'lucide-react';
import clsx from 'clsx';
import type { Issue, ResourceAllocation, User } from '../types/redmine';
import { formatHours, today as todayFn } from '../lib/format';
import {
  ZOOM_PRESETS,
  clipBarToWindow,
  defaultWindowStart,
  parseLocalIso,
  windowDates,
  type ZoomLevel,
} from '../lib/ganttWindow';

interface Props {
  users: User[];
  issues: Issue[];
  allocations: ResourceAllocation[];
  /** Optional fixed window start. When omitted, defaults to a window
   *  centered on today (Monday-aligned). */
  startDate?: string;
  /** Optional fixed days. When omitted, derived from the active zoom. */
  days?: number;
  /** Optional initial zoom level. Defaults to "Week". */
  initialZoom?: ZoomLevel;
}

const ZOOMS: ZoomLevel[] = ['Day', 'Week', 'Month', 'Quarter', 'Year'];

export default function ResourceTimeline({
  users,
  issues,
  allocations,
  startDate,
  days,
  initialZoom = 'Week',
}: Props) {
  const [zoom, setZoom] = useState<ZoomLevel>(initialZoom);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const today = useMemo(() => todayFn(), []);

  // Zoom-driven window sizing. Props override the preset when supplied so
  // existing callers / tests that pin a window keep working.
  const preset = ZOOM_PRESETS[zoom];
  const daysVisible = days ?? preset.days;
  const cellWidth = preset.cellWidth;
  const startIso = useMemo(
    () => startDate ?? defaultWindowStart(today, daysVisible),
    [startDate, today, daysVisible],
  );

  const dates = useMemo(
    () => windowDates(startIso, daysVisible),
    [startIso, daysVisible],
  );
  const totalWidth = dates.length * cellWidth;

  const grouped = useMemo(() => {
    return users.map((u) => {
      const userIssues = issues.filter((i) => i.assignee?.id === u.id);
      const userAllocs = allocations.filter((a) => a.userId === u.id);
      // A user row is "no dates available" when none of its issues have
      // either a start or due date — in that case we render a striped
      // placeholder instead of a blank timeline so it's clear that the
      // blankness is upstream data, not a load bug.
      const hasAnyDate = userIssues.some(
        (i) => (i.startDate && i.startDate.length > 0) || (i.dueDate && i.dueDate.length > 0),
      );
      return { user: u, issues: userIssues, allocations: userAllocs, hasAnyDate };
    });
  }, [users, issues, allocations]);

  // Auto-scroll the timeline pane so "today" lands near the left third of
  // the visible area on first render. Only fires on mount + when the window
  // start changes — manual scrolling afterwards is preserved.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const todayMidnight = new Date(today);
    todayMidnight.setHours(0, 0, 0, 0);
    const start = parseLocalIso(startIso);
    const idx = Math.floor((todayMidnight.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    if (idx < 0 || idx >= daysVisible) return;
    // Position "today" about 1/3 from the left of the visible pane.
    const visiblePx = el.clientWidth;
    const target = Math.max(0, idx * cellWidth - visiblePx / 3);
    // jsdom (test env) doesn't implement scrollTo; fall back to setting
    // scrollLeft directly so unit tests render the component without throwing.
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ left: target, behavior: 'auto' });
    } else {
      el.scrollLeft = target;
    }
  }, [startIso, daysVisible, cellWidth, today]);

  return (
    <div className="card overflow-hidden" data-testid="resource-timeline">
      <div className="px-4 py-3 flex items-center gap-3 border-b">
        <div className="font-semibold">Resource allocation</div>
        <div className="ml-4 flex bg-canvas rounded p-0.5 text-xs">
          {ZOOMS.map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              data-testid={`gantt-zoom-${z}`}
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
        <div className="flex-1 overflow-x-auto" ref={scrollRef}>
          <div style={{ width: totalWidth }}>
            <div
              className="grid bg-canvas text-xs text-ink-muted"
              style={{ gridTemplateColumns: `repeat(${dates.length}, ${cellWidth}px)` }}
            >
              {dates.map((dt) => (
                <div
                  key={dt.toISOString()}
                  className={clsx(
                    'px-1 py-2 text-center border-r border-gray-100',
                    dt.getDay() === 0 || dt.getDay() === 6 ? 'bg-canvas/70' : '',
                    dt.toDateString() === today.toDateString() && 'bg-brand-100 text-ink',
                  )}
                >
                  <div className="text-[10px]">{dt.toLocaleDateString(undefined, { weekday: 'short' })[0]}</div>
                  <div>{dt.getDate()}</div>
                </div>
              ))}
            </div>

            {grouped.map(({ user, allocations: userAllocs, hasAnyDate }) => {
              const isExpanded = expanded[user.id] ?? false;
              return (
                <div key={user.id}>
                  <div
                    className="relative border-t border-gray-100 h-10 grid"
                    style={{ gridTemplateColumns: `repeat(${dates.length}, ${cellWidth}px)` }}
                    data-testid={`gantt-row-${user.id}`}
                    data-no-date={!hasAnyDate}
                  >
                    {dates.map((dt) => (
                      <div
                        key={dt.toISOString()}
                        className={clsx(
                          'border-r border-gray-100 h-10',
                          dt.toDateString() === today.toDateString() && 'bg-brand-100/40',
                        )}
                      />
                    ))}

                    {!hasAnyDate && (
                      // Striped placeholder so the user sees a clear "no
                      // dates set in Redmine" affordance instead of a blank
                      // row that looks like a load bug.
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={{
                          backgroundImage:
                            'repeating-linear-gradient(45deg, rgba(0,0,0,0.04) 0 6px, transparent 6px 12px)',
                        }}
                        aria-hidden
                        title="No tasks with start or due dates in Redmine"
                      />
                    )}

                    {userAllocs.map((a) => {
                      const rect = clipBarToWindow(
                        startIso,
                        daysVisible,
                        cellWidth,
                        a.startDate,
                        a.endDate,
                      );
                      if (!rect) return null;
                      return (
                        <div
                          key={a.id}
                          data-testid={`gantt-bar-${a.id}`}
                          className={clsx(
                            'absolute top-2 h-6 rounded text-[10px] text-white px-2 flex items-center gap-1 shadow overflow-hidden',
                            a.isOverloaded
                              ? 'bg-red-500'
                              : a.allocationType === 'Manual'
                              ? 'bg-purple-500'
                              : 'bg-blue-500',
                            rect.clippedLeft && 'rounded-l-none border-l border-dashed border-white/70',
                            rect.clippedRight && 'rounded-r-none border-r border-dashed border-white/70',
                          )}
                          style={{ left: rect.left, width: rect.width }}
                          title={
                            `${formatHours(a.allocatedHours)} allocated · ${formatHours(a.spentHours)} spent` +
                            (rect.clippedLeft ? ' · starts before window' : '') +
                            (rect.clippedRight ? ' · extends past window' : '')
                          }
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
                          style={{ gridTemplateColumns: `repeat(${dates.length}, ${cellWidth}px)` }}
                        >
                          {dates.map((dt) => (
                            <div
                              key={dt.toISOString()}
                              className={clsx(
                                'border-r border-gray-100 h-10',
                                dt.toDateString() === today.toDateString() && 'bg-brand-100/30',
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
