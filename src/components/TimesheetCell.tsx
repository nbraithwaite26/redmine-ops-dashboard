import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { TimeEntry } from '../types/redmine';
import { formatCellHours, parseCellInput } from '../lib/timesheet';

export type CellStatus = 'idle' | 'saving' | 'error';

interface Props {
  /** Visible value on the cell — sum of hours for (issue, day). */
  hours: number;
  /** Underlying entries, newest-first. Used by callers; this component
   *  only reads `entries.length` to decide the multi-entry hint. */
  entries: TimeEntry[];
  /** True for today's column — softer ring. */
  isToday: boolean;
  /** Saturday/Sunday cells get muted bg unless populated. */
  isWeekend: boolean;
  /** Save status surfaced from the parent. */
  status: CellStatus;
  /** Save the cell. Caller decides create vs update vs delete based on
   *  prior state. The cell calls this on blur when the value changes. */
  onCommit: (nextHours: number) => Promise<void> | void;
  /** True when the project has no default activity picked — cell is
   *  inert (read-only) and shows a hint. */
  disabled?: boolean;
  /** Reason for being disabled — surfaced as a tooltip + hint. */
  disabledReason?: string;
  testId?: string;
}

/**
 * One day cell on the timesheet grid. Numeric input with 0.25-step,
 * optimistic blur-to-save, error pill on failure. Multi-entry cells
 * (more than one underlying time entry on the same (issue, day)) get a
 * small dot so the user knows editing the value here only touches the
 * most-recent entry; deeper editing happens in the popover (caller's
 * responsibility — this component just signals the dot).
 */
export default function TimesheetCell({
  hours,
  entries,
  isToday,
  isWeekend,
  status,
  onCommit,
  disabled,
  disabledReason,
  testId,
}: Props) {
  const [draft, setDraft] = useState<string>(() => (hours > 0 ? String(hours) : ''));
  const lastCommittedRef = useRef<number>(hours);

  // Keep the input in sync when the upstream value changes from outside
  // (e.g. successful save reloads entries, or the user changes weeks).
  useEffect(() => {
    setDraft(hours > 0 ? String(hours) : '');
    lastCommittedRef.current = hours;
  }, [hours]);

  const populated = hours > 0;
  const multiEntry = entries.length > 1;

  function commit(): void {
    if (disabled) return;
    const parsed = parseCellInput(draft);
    if (parsed === null) {
      // Invalid input — snap back to last committed value.
      setDraft(lastCommittedRef.current > 0 ? String(lastCommittedRef.current) : '');
      return;
    }
    if (parsed === lastCommittedRef.current) return;
    lastCommittedRef.current = parsed;
    void onCommit(parsed);
  }

  return (
    <div
      className={
        'relative flex items-center justify-end ' +
        (isToday ? 'bg-brand-50/30 ' : '') +
        (isWeekend && !populated ? 'bg-subtle/50 ' : '')
      }
      data-testid={testId}
      data-populated={populated ? 'true' : 'false'}
      title={disabled ? disabledReason : undefined}
    >
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        placeholder={disabled ? '' : '—'}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setDraft(lastCommittedRef.current > 0 ? String(lastCommittedRef.current) : '');
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        className={
          'h-9 w-full bg-transparent px-2 text-right text-sm tabular-nums outline-none ' +
          (populated ? 'text-ink' : 'text-ink-muted placeholder:text-ink-muted/60') +
          (disabled ? ' cursor-not-allowed opacity-60' : ' focus:bg-canvas focus:ring-1 focus:ring-brand-400')
        }
        aria-label="Hours"
      />
      {status === 'saving' && (
        <Loader2
          size={11}
          className="pointer-events-none absolute right-1 top-1 animate-spin text-ink-muted"
          aria-hidden
        />
      )}
      {status === 'error' && (
        <AlertCircle
          size={11}
          className="pointer-events-none absolute right-1 top-1 text-red-500"
          aria-hidden
        />
      )}
      {multiEntry && status !== 'saving' && status !== 'error' && (
        <span
          aria-hidden
          title={`${entries.length} entries on this day`}
          className="pointer-events-none absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-brand-500"
        />
      )}
      {/* Helper text fallback when there's a value with no .toFixed slot. */}
      <span className="sr-only">{formatCellHours(hours)}</span>
    </div>
  );
}
