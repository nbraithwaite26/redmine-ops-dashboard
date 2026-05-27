import { useEffect, useMemo, useState } from 'react';
import { motion, useDragControls, useReducedMotion } from 'framer-motion';
import { CalendarOff, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getTimeOff } from '../services/redmineApi';
import { today } from '../lib/format';
import { initials } from '../lib/avatar';
import {
  distinctEngineersOut,
  groupByDate,
  isoDate,
  legendTypes,
  monthDays,
  rangeOf,
  timeOffColor,
  weekDays,
} from '../lib/timeOff';
import type { TimeOffEntry } from '../types/redmine';

interface Props {
  onClose: () => void;
}

type View = 'week' | 'month';

const HERO = 'linear-gradient(135deg, #0f766e 0%, #134e4a 100%)';

/**
 * Full-screen time-off calendar. Morphs out of the EngineersOutCard (shared
 * `layoutId`). A week ⇄ month toggle (default week) and prev/next navigation
 * page through periods; entries are color-coded by leave type with a legend.
 * Dismiss via close / Escape / backdrop / swipe-down. Honors reduced-motion.
 */
export default function TimeOffDetail({ onClose }: Props) {
  const reduce = useReducedMotion();
  const dragControls = useDragControls();

  const [view, setView] = useState<View>('week');
  const [offset, setOffset] = useState(0); // weeks or months from the current period
  const [entries, setEntries] = useState<TimeOffEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const reference = useMemo(() => today(), []);
  const days = useMemo(
    () => (view === 'week' ? weekDays(reference, offset) : monthDays(reference, offset)),
    [view, offset, reference],
  );
  const range = useMemo(() => rangeOf(days), [days]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const data = await getTimeOff(range);
      if (cancelled) return;
      setEntries(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [range]);

  // Scroll-lock + Escape while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const byDate = useMemo(() => groupByDate(entries), [entries]);
  const legend = useMemo(() => legendTypes(entries), [entries]);
  const outCount = distinctEngineersOut(entries);

  const periodLabel =
    view === 'week'
      ? `${fmtShort(days[0])} – ${fmtShort(days[days.length - 1])}`
      : reference.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const setViewReset = (v: View) => {
    setView(v);
    setOffset(0);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Time off calendar"
    >
      <motion.div
        className="absolute inset-0 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        data-testid="timeoff-backdrop"
      />

      <motion.div
        layoutId="engineers-out-card"
        drag={reduce ? false : 'y'}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120 || info.velocity.y > 600) onClose();
        }}
        style={{ borderRadius: 0, background: 'var(--bg-card)' }}
        className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden shadow-2xl"
        data-testid="timeoff-detail"
      >
        {/* Hero */}
        <div
          className="relative shrink-0 px-5 pb-5 text-white"
          style={{ background: HERO, paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)' }}
        >
          {!reduce && (
            <div
              className="absolute left-1/2 top-2 h-1.5 w-10 -translate-x-1/2 cursor-grab touch-none rounded-full bg-white/40 active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
              aria-hidden
            />
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-black/20 text-white backdrop-blur transition hover:bg-black/30"
            aria-label="Close"
            data-testid="timeoff-close"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3 pt-2">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white/20 backdrop-blur">
              <CalendarOff size={20} />
            </span>
            <div>
              <div className="text-xl font-semibold leading-tight">Out of office</div>
              <div className="text-sm text-white/85">{outCount} engineers out · {periodLabel}</div>
            </div>
          </div>

          {/* Controls: view toggle + period nav */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex overflow-hidden rounded-md bg-white/15 text-sm">
              {(['week', 'month'] as View[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setViewReset(v)}
                  aria-pressed={view === v}
                  data-testid={`timeoff-view-${v}`}
                  className={view === v ? 'bg-white px-3 py-1 font-medium text-ink' : 'px-3 py-1 text-white/90'}
                >
                  {v === 'week' ? 'Week' : 'Month'}
                </button>
              ))}
            </div>
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => setOffset((o) => o - 1)}
                aria-label="Previous"
                data-testid="timeoff-prev"
                className="grid h-8 w-8 place-items-center rounded-full bg-white/15 hover:bg-white/25"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setOffset((o) => o + 1)}
                aria-label="Next"
                data-testid="timeoff-next"
                className="grid h-8 w-8 place-items-center rounded-full bg-white/15 hover:bg-white/25"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
        >
          {loading ? (
            <div className="card p-6 text-center text-sm text-ink-muted" data-testid="timeoff-loading">
              Loading time off…
            </div>
          ) : view === 'week' ? (
            <WeekView days={days} byDate={byDate} />
          ) : (
            <MonthView days={days} byDate={byDate} />
          )}

          {!loading && legend.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3" data-testid="timeoff-legend">
              {legend.map((type) => (
                <span key={type} className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                  <span className="h-3 w-3 rounded-full" style={{ background: timeOffColor(type) }} />
                  {type}
                </span>
              ))}
            </div>
          )}
          {!loading && entries.length === 0 && (
            <div className="card mt-3 p-6 text-center text-sm text-ink-muted" data-testid="timeoff-empty">
              No one is out this {view}.
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function WeekView({
  days,
  byDate,
}: {
  days: Date[];
  byDate: Map<string, TimeOffEntry[]>;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-100">
      {days.map((d) => {
        const key = isoDate(d);
        const dayEntries = byDate.get(key) ?? [];
        return (
          <div
            key={key}
            className="flex items-start gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0"
            data-testid={`timeoff-day-${key}`}
          >
            <div className="w-24 shrink-0 text-sm">
              <span className="font-medium">{fmtWeekday(d)}</span>{' '}
              <span className="text-ink-muted">{d.getDate()}</span>
            </div>
            {dayEntries.length === 0 ? (
              <span className="text-xs text-ink-muted">—</span>
            ) : (
              <div className="flex flex-1 flex-wrap gap-1.5">
                {dayEntries.map((e) => (
                  <span
                    key={e.id}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ background: timeOffColor(e.type) }}
                    title={`${e.user.name} — ${e.type}`}
                  >
                    {initials(e.user.name)} · {e.type}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MonthView({
  days,
  byDate,
}: {
  days: Date[];
  byDate: Map<string, TimeOffEntry[]>;
}) {
  // Monday-anchored leading blanks so day 1 lands under its weekday.
  const leading = (days[0].getDay() + 6) % 7;
  const headers = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <div className="grid grid-cols-7 gap-1">
      {headers.map((h) => (
        <div key={h} className="pb-1 text-center text-[10px] uppercase tracking-wide text-ink-muted">
          {h}
        </div>
      ))}
      {Array.from({ length: leading }, (_, i) => (
        <div key={`blank-${i}`} />
      ))}
      {days.map((d) => {
        const key = isoDate(d);
        const dayEntries = byDate.get(key) ?? [];
        return (
          <div
            key={key}
            className="min-h-[3.5rem] rounded border border-gray-100 p-1"
            data-testid={`timeoff-day-${key}`}
          >
            <div className="text-[10px] text-ink-muted">{d.getDate()}</div>
            <div className="mt-0.5 flex flex-wrap gap-0.5">
              {dayEntries.map((e) => (
                <span
                  key={e.id}
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: timeOffColor(e.type) }}
                  title={`${e.user.name} — ${e.type}`}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
function fmtWeekday(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}
