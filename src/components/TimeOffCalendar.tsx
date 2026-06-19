import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Filter, Loader2 } from 'lucide-react';
import { getTimeOff } from '../services/redmineApi';
import { today } from '../lib/format';
import {
  addDays,
  addMonths,
  groupByDate,
  isoDate,
  monthGridRowsOf,
  periodLabel,
  rangeOf,
  timeOffColor,
  todayAnchor,
  weekDaysSunOf,
} from '../lib/timeOff';
import type { TimeOffEntry } from '../types/redmine';

interface Props {
  /** Optional user-id filter — entries whose user is NOT in the set are
   *  hidden. The Dashboard passes the (eng) Aircraft group members; pass
   *  `null` or omit to show everyone. */
  memberIds?: ReadonlySet<number> | null;
}

type View = 'week' | 'month';

/**
 * Activity types that are pre-selected when the calendar first loads:
 * Vacation, Personal Time, Customer Visit (any FOF/FOT variant),
 * Conference/Seminar. "In Office" and other at-work categories stay
 * unchecked by default so the calendar reads as time-off-first; the user
 * can toggle anything on via the Filter dropdown.
 */
const DEFAULT_ON_TYPE_PATTERNS = [
  /^vacation/i,
  /^personal time/i,
  /^customer visit/i,
  /conference|seminar/i,
  /\bFOT\b/i,
];

function isOnByDefault(type: string): boolean {
  return DEFAULT_ON_TYPE_PATTERNS.some((p) => p.test(type));
}

/**
 * AE Calendar — inline view that mirrors Easy Redmine's `/easy_calendars`
 * page, information-wise:
 *
 *   - Sunday-anchored 6-week month grid with adjacent-month days dimmed
 *   - ISO 8601 week numbers on the left margin
 *   - Per-day total hours in each cell header
 *   - Per-week total hours in a right "Hours" column
 *   - Entries show user (email local-part), HH:MM–HH:MM time range,
 *     activity type, and a small colored bar by type
 *   - Bottom legend matching the upstream activity-state icons
 *
 * Data flows through `getTimeOff({from, to, includeAtWork: true})` →
 * `/api/redmine/time-off?include_at_work=true` → Easy Redmine's
 * `/easy_attendances.json` so the dashboard reflects every category the
 * upstream calendar shows (OOO + Conference/Seminar + Customer Visit, etc.).
 *
 * Member filter: when `memberIds` is non-null, entries are post-filtered
 * client-side to that user set. Keeps the visible activities consistent
 * with the (eng) Aircraft team without changing the backend route.
 */
export default function TimeOffCalendar({ memberIds }: Props) {
  const reference = useMemo(() => today(), []);
  const [view, setView] = useState<View>('month');
  const [anchorIso, setAnchorIso] = useState<string>(() => todayAnchor(reference));
  const [entries, setEntries] = useState<TimeOffEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  // Type filter: union of every activity type we've ever seen (so the
  // dropdown still lists "Vacation" even on a week with no vacation rows).
  // `selectedTypes` is initialized on the first non-empty fetch from
  // `isOnByDefault`; afterwards it's user-controlled.
  const [knownTypes, setKnownTypes] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<Set<string> | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // For the WEEK view we still pass a 7-day range; the month view always
  // ranges over the full 6-week grid so adjacent-month days fill in too.
  const days = useMemo(() => {
    if (view === 'week') return weekDaysSunOf(anchorIso);
    return monthGridRowsOf(anchorIso).flatMap((r) => r.cells.map((c) => c.date));
  }, [view, anchorIso]);
  const range = useMemo(() => rangeOf(days), [days]);

  // Re-fetch whenever the visible range changes. Subsequent fetches keep
  // the calendar grid mounted; only the small "fetching" chip toggles.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const data = await getTimeOff({ ...range, includeAtWork: true });
      if (cancelled) return;
      setEntries(data);
      setLoading(false);
      setHasLoadedOnce(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [range]);

  // Merge any newly-seen activity types into the known set, and seed the
  // user's selection on the first non-empty load.
  useEffect(() => {
    if (entries.length === 0) return;
    const seen = new Set<string>();
    for (const e of entries) seen.add(e.type);
    setKnownTypes((prev) => {
      const merged = new Set(prev);
      for (const t of seen) merged.add(t);
      return Array.from(merged).sort((a, b) => a.localeCompare(b));
    });
    setSelectedTypes((prev) => {
      if (prev !== null) return prev;
      return new Set(Array.from(seen).filter(isOnByDefault));
    });
  }, [entries]);

  // Close the filter popover on outside click.
  useEffect(() => {
    if (!filterOpen) return;
    function onDown(ev: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(ev.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [filterOpen]);

  // Apply member + type filters. Memoised so the count + visible entries
  // read the SAME filtered set.
  const scoped = useMemo<TimeOffEntry[]>(() => {
    let arr: TimeOffEntry[] = entries;
    if (memberIds) arr = arr.filter((e) => memberIds.has(e.user.id));
    if (selectedTypes !== null) arr = arr.filter((e) => selectedTypes.has(e.type));
    return arr;
  }, [entries, memberIds, selectedTypes]);

  const byDate = useMemo(() => groupByDate(scoped), [scoped]);
  const totalEntries = scoped.length;
  const label = periodLabel(anchorIso, view);

  const showInitialSpinner = loading && !hasLoadedOnce;
  const isRefetching = loading && hasLoadedOnce;

  function movePrev(): void {
    setAnchorIso((p) => (view === 'week' ? addDays(p, -7) : addMonths(p, -1)));
  }
  function moveNext(): void {
    setAnchorIso((p) => (view === 'week' ? addDays(p, 7) : addMonths(p, 1)));
  }
  function goToday(): void {
    setAnchorIso(todayAnchor(reference));
  }

  return (
    <section className="card overflow-hidden" data-testid="timeoff-calendar">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default bg-canvas/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className="grid h-9 w-9 place-items-center rounded-full text-white"
            style={{ background: 'linear-gradient(135deg, #0f766e 0%, #134e4a 100%)' }}
          >
            <CalendarDays size={16} />
          </span>
          <div className="min-w-0">
            <div className="text-base font-semibold leading-tight">
              AE Calendar ({totalEntries})
            </div>
            <div className="text-xs text-ink-muted">Live from Redmine attendances</div>
          </div>
        </div>

        <div
          className="flex flex-1 items-center justify-end gap-2"
          data-testid="timeoff-period-label"
        >
          <span className="text-base font-semibold text-ink">{label}</span>
          {isRefetching && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted"
              data-testid="timeoff-fetching"
              aria-live="polite"
            >
              <Loader2 size={10} className="animate-spin" />
              fetching
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              aria-expanded={filterOpen}
              aria-haspopup="menu"
              data-testid="timeoff-filter"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-border-default px-3 py-1.5 text-sm text-ink-soft hover:bg-canvas"
            >
              <Filter size={14} />
              <span>Filter</span>
              <span className="rounded-full bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
                {selectedTypes?.size ?? 0}/{knownTypes.length}
              </span>
            </button>
            {filterOpen && (
              <div
                role="menu"
                data-testid="timeoff-filter-menu"
                className="absolute left-0 z-20 mt-2 w-64 rounded-lg border border-border-default bg-surface p-2 text-sm shadow-card"
              >
                <div className="flex items-center justify-between px-2 py-1 text-[11px] uppercase tracking-wide text-ink-muted">
                  <span>Activity types</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTypes(new Set(knownTypes))}
                      className="text-ink-soft hover:underline"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTypes(new Set())}
                      className="text-ink-soft hover:underline"
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {knownTypes.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-ink-muted">No types loaded yet.</div>
                  ) : (
                    knownTypes.map((t) => {
                      const checked = selectedTypes?.has(t) ?? false;
                      const c = timeOffColor(t);
                      return (
                        <label
                          key={t}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-canvas"
                          data-testid={`timeoff-filter-option-${t}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelectedTypes((prev) => {
                                const next = new Set(prev ?? []);
                                if (next.has(t)) next.delete(t);
                                else next.add(t);
                                return next;
                              })
                            }
                            style={{ accentColor: c }}
                          />
                          <span
                            aria-hidden
                            className="inline-block h-2.5 w-2.5 rounded-sm"
                            style={{ background: c }}
                          />
                          <span className="flex-1 truncate text-xs text-ink">{t}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="inline-flex overflow-hidden rounded-md border border-border-default text-sm">
            {(['week', 'month'] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                data-testid={`timeoff-toggle-${v}`}
                className={
                  'px-3 py-1.5 min-h-[36px] ' +
                  (view === v ? 'bg-brand-500 font-medium text-white' : 'text-ink-muted hover:bg-canvas')
                }
              >
                {v === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={movePrev}
              aria-label={view === 'week' ? 'Previous week' : 'Previous month'}
              data-testid="timeoff-prev"
              className="grid h-9 w-9 place-items-center rounded-full border border-border-default text-ink-muted hover:bg-canvas"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={goToday}
              aria-label="Jump to today"
              data-testid="timeoff-today"
              className="rounded-full border border-border-default px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted hover:bg-canvas"
            >
              Today
            </button>
            <button
              type="button"
              onClick={moveNext}
              aria-label={view === 'week' ? 'Next week' : 'Next month'}
              data-testid="timeoff-next"
              className="grid h-9 w-9 place-items-center rounded-full border border-border-default text-ink-muted hover:bg-canvas"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="p-4">
        {showInitialSpinner ? (
          <div className="p-6 text-center text-sm text-ink-muted" data-testid="timeoff-loading">
            Loading calendar…
          </div>
        ) : (
          <div
            className={isRefetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}
            data-testid="timeoff-calendar-grid"
          >
            {view === 'month' ? (
              <MonthView anchorIso={anchorIso} byDate={byDate} today={reference} />
            ) : (
              <WeekView days={days} byDate={byDate} today={reference} />
            )}
          </div>
        )}

        {!showInitialSpinner && totalEntries === 0 && !isRefetching && (
          <div
            className="mt-3 rounded-lg border border-dashed border-border-default p-6 text-center text-sm text-ink-muted"
            data-testid="timeoff-empty"
          >
            No attendance entries this {view}.
          </div>
        )}

        {!showInitialSpinner && <Legend />}
      </div>
    </section>
  );
}

/**
 * Bottom legend matching the AE Calendar's five activity states. We only
 * implement the first three states today (beginning / day / ending);
 * the pending/rejected states will light up if we ever expose approval
 * status through the wire format.
 */
function Legend() {
  const items: Array<{ label: string; arrow: 'right' | 'left' | 'circle' }> = [
    { label: 'Activity beginning', arrow: 'right' },
    { label: 'Activity ending', arrow: 'left' },
    { label: 'This day activity', arrow: 'circle' },
  ];
  return (
    <div className="mt-4 flex flex-wrap gap-4 text-xs text-ink-muted" data-testid="timeoff-legend">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <StateGlyph arrow={it.arrow} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Small triangle glyph used in the legend + entry rows. */
function StateGlyph({ arrow }: { arrow: 'right' | 'left' | 'circle' }) {
  if (arrow === 'circle') {
    return <span className="block h-2 w-2 rounded-full bg-red-500" aria-hidden />;
  }
  const className = arrow === 'right' ? 'border-l-red-500' : 'border-r-red-500';
  return (
    <span
      aria-hidden
      className={
        'block h-0 w-0 border-y-4 border-y-transparent ' +
        (arrow === 'right' ? 'border-l-[6px] ' : 'border-r-[6px] ') +
        className
      }
    />
  );
}

/**
 * Pick the activity-state arrow for a given entry on a given day:
 *   - day === entry.date → beginning
 *   - day > entry.date  → ending  (multi-day spans render this only when
 *                                  the upstream sends multiple entries
 *                                  per day; today's wire format only emits
 *                                  one per day so this rarely surfaces)
 *   - default            → circle (single-day activity)
 *
 * Returns the arrow type only. The arrow's color is keyed off the activity
 * type via `timeOffColor`.
 */
function entryStateOn(entry: TimeOffEntry): 'right' | 'circle' {
  // The wire format gives us one row per day with start/end times, not a
  // multi-day span, so every entry renders as a "beginning" arrow today —
  // matching the screenshot's red ▶ at the start of each row.
  void entry; // intentional; kept for the future multi-day case.
  return 'right';
}

function MonthView({
  anchorIso,
  byDate,
  today,
}: {
  anchorIso: string;
  byDate: Map<string, TimeOffEntry[]>;
  today: Date;
}) {
  const rows = monthGridRowsOf(anchorIso);
  const headers = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayIso = isoDate(today);

  // Layout: [week# 36px] [7 day cells, equal] [right "Hours" column 80px].
  const gridCols = 'grid-cols-[36px_repeat(7,_minmax(0,1fr))_80px]';

  return (
    <div className={`grid gap-px rounded-lg bg-border-muted ${gridCols}`}>
      {/* Header row: empty cell + 7 weekday labels + "Hours" */}
      <div />
      {headers.map((h) => (
        <div
          key={h}
          className="bg-canvas px-2 py-1 text-center text-[11px] uppercase tracking-wide text-ink-muted"
        >
          {h}
        </div>
      ))}
      <div className="bg-canvas px-2 py-1 text-center text-[11px] uppercase tracking-wide text-ink-muted">
        Hours
      </div>

      {rows.map((row) => {
        const weekHours = row.cells.reduce(
          (sum, c) => sum + (byDate.get(c.iso)?.reduce((s, e) => s + e.hours, 0) ?? 0),
          0,
        );
        return (
          <Row key={row.weekNumber + '-' + row.cells[0]!.iso}>
            <div
              className="grid place-items-center bg-canvas/60 text-xs text-ink-muted"
              data-testid={`timeoff-week-number-${row.weekNumber}`}
            >
              {row.weekNumber}
            </div>

            {row.cells.map((c) => {
              const dayEntries = byDate.get(c.iso) ?? [];
              const dayHours = dayEntries.reduce((s, e) => s + e.hours, 0);
              const isToday = c.iso === todayIso;
              return (
                <DayCell
                  key={c.iso}
                  date={c.date}
                  iso={c.iso}
                  outsideMonth={c.outsideMonth}
                  isToday={isToday}
                  hours={dayHours}
                  entries={dayEntries}
                />
              );
            })}

            <div className="grid place-items-end bg-canvas px-2 py-1 text-xs tabular-nums text-ink-muted">
              {weekHours > 0 ? formatHoursH(weekHours) : ''}
            </div>
          </Row>
        );
      })}
    </div>
  );
}

/** Just a row wrapper that contributes to the parent grid layout. */
function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function DayCell({
  iso,
  date,
  outsideMonth,
  isToday,
  hours,
  entries,
}: {
  iso: string;
  date: Date;
  outsideMonth: boolean;
  isToday: boolean;
  hours: number;
  entries: TimeOffEntry[];
}) {
  return (
    <div
      data-testid={`timeoff-day-${iso}`}
      data-outside-month={outsideMonth ? 'true' : 'false'}
      className={
        'flex min-h-[110px] flex-col gap-1 p-1 text-xs ' +
        (outsideMonth ? 'bg-subtle text-ink-muted' : 'bg-canvas') +
        (isToday ? ' ring-1 ring-inset ring-brand-300' : '')
      }
    >
      <div className="flex items-center justify-between text-[10px]">
        <span className={outsideMonth ? 'text-ink-muted' : 'font-medium text-ink'}>
          {date.getDate()}
        </span>
        <span className="tabular-nums text-ink-muted">{hours > 0 ? formatHoursH(hours) : '0.00 h'}</span>
      </div>
      <div className="flex flex-col gap-1">
        {entries.map((e) => (
          <EntryRow key={e.id} entry={e} />
        ))}
      </div>
    </div>
  );
}

/**
 * A single attendance entry as drawn in the screenshot:
 *   ▶ user@avionica.com
 *     09:00 - 17:00  Vacation
 */
function EntryRow({ entry }: { entry: TimeOffEntry }) {
  const color = timeOffColor(entry.type);
  const time =
    entry.startTime && entry.endTime
      ? `${entry.startTime} - ${entry.endTime}`
      : entry.startTime ?? '';
  return (
    <div
      data-testid={`timeoff-entry-${entry.id}`}
      className="flex items-start gap-1 rounded-sm border-l-[3px] px-1 py-0.5 text-[10px] leading-tight"
      style={{ borderLeftColor: color, background: color + '20' }}
      title={
        `${entry.user.name} · ${entry.type}` +
        (entry.hours > 0 ? ` · ${entry.hours}h` : '') +
        (entry.description ? ` — ${entry.description}` : '')
      }
    >
      <StateGlyph arrow={entryStateOn(entry)} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-ink">{shortUserName(entry.user.name)}</div>
        <div className="truncate text-ink-muted">
          {time && <span className="tabular-nums">{time}</span>}
          {time && <span> </span>}
          <span className="italic" style={{ color }}>{entry.type}</span>
        </div>
      </div>
    </div>
  );
}

function WeekView({
  days,
  byDate,
  today,
}: {
  days: Date[];
  byDate: Map<string, TimeOffEntry[]>;
  today: Date;
}) {
  const todayIso = isoDate(today);
  return (
    <div className="overflow-hidden rounded-lg border border-border-default">
      {days.map((d) => {
        const key = isoDate(d);
        const dayEntries = byDate.get(key) ?? [];
        const dayHours = dayEntries.reduce((s, e) => s + e.hours, 0);
        const isToday = key === todayIso;
        return (
          <div
            key={key}
            data-testid={`timeoff-day-${key}`}
            className={
              'flex items-start gap-3 border-b border-border-default px-3 py-2 last:border-b-0 ' +
              (isToday ? 'bg-brand-100/30' : '')
            }
          >
            <div className="w-28 shrink-0 text-sm">
              <span className="font-medium">{fmtWeekday(d)}</span>{' '}
              <span className="text-ink-muted">{d.getDate()}</span>
              <div className="text-[10px] text-ink-muted">
                {dayHours > 0 ? formatHoursH(dayHours) : '—'}
              </div>
            </div>
            {dayEntries.length === 0 ? (
              <span className="text-xs text-ink-muted">—</span>
            ) : (
              <div className="flex flex-1 flex-col gap-1">
                {dayEntries.map((e) => (
                  <EntryRow key={e.id} entry={e} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function fmtWeekday(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

function shortUserName(name: string): string {
  const at = name.indexOf('@');
  return at > 0 ? name.slice(0, at) : name;
}

/** Format hours as e.g. "8.00 h" / "25.00 h" — matching the screenshot. */
function formatHoursH(hours: number): string {
  return `${hours.toFixed(2)} h`;
}
