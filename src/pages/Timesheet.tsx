import { useCallback, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { useProjectDefaultActivity } from '../hooks/useProjectDefaultActivity';
import { useTimeEntryActions } from '../hooks/useTimeEntryActions';
import { getCurrentUser, getMyIssues, getTimeActivities, getTimeEntries } from '../services/redmineApi';
import { isoDate } from '../lib/timeOff';
import { today } from '../lib/format';
import {
  aggregateByCell,
  cellKey,
  dayTotal,
  formatCellHours,
  groupByProject,
  shiftWeeks,
  weekLabel,
  weekOf,
} from '../lib/timesheet';
import type { Issue, TimeEntry, User } from '../types/redmine';
import ProjectActivityPicker from '../components/ProjectActivityPicker';
import TimesheetCell from '../components/TimesheetCell';
import type { CellStatus } from '../components/TimesheetCell';

interface Bundle {
  user: User | null;
  issues: Issue[];
  entries: TimeEntry[];
  activities: string[];
}

const EMPTY_BUNDLE: Bundle = { user: null, issues: [], entries: [], activities: [] };

const WEEK_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Timesheet() {
  const reference = useMemo(() => today(), []);
  const [anchorIso, setAnchorIso] = useState<string>(() => isoDate(reference));
  const week = useMemo(() => weekOf(anchorIso), [anchorIso]);
  const todayIso = useMemo(() => isoDate(reference), [reference]);
  const dayIsos = useMemo(() => week.days.map((d) => isoDate(d)), [week]);

  const resource = useAsyncResource<Bundle>(
    useCallback(async () => {
      const user = await getCurrentUser().catch(() => null);
      const [issues, entries, activities] = await Promise.all([
        getMyIssues(user?.id),
        getTimeEntries({ from: week.from, to: week.to, userId: user?.id }),
        getTimeActivities(),
      ]);
      return { user, issues, entries, activities };
    }, [week.from, week.to]),
    EMPTY_BUNDLE,
    [week.from, week.to],
  );

  const { user, issues, entries, activities } = resource.data;
  const projectRows = useMemo(() => groupByProject(issues), [issues]);
  const aggregates = useMemo(() => aggregateByCell(entries), [entries]);

  const { create, save, remove } = useTimeEntryActions();

  // Per-cell save status — keyed by cellKey(issueId, projectId, dayIso).
  const [cellStatus, setCellStatus] = useState<Record<string, CellStatus>>({});

  const onCellCommit = useCallback(
    async (issue: Issue, dayIso: string, nextHours: number, activity: string | null) => {
      const key = cellKey(issue.id, issue.projectId, dayIso);
      if (!activity) {
        setCellStatus((s) => ({ ...s, [key]: 'error' }));
        return;
      }
      const aggregate = aggregates.get(key);
      setCellStatus((s) => ({ ...s, [key]: 'saving' }));
      try {
        if (nextHours <= 0 && aggregate && aggregate.entries.length > 0) {
          // Cleared cell: delete the most-recent entry. Older entries
          // (if any) remain — user can clear them via the popover.
          await remove(aggregate.entries[0]!.id);
        } else if (aggregate && aggregate.entries.length > 0) {
          // Edit the most-recent entry's hours to the new total minus
          // the sum of the other entries (so the cell reads `nextHours`).
          const newest = aggregate.entries[0]!;
          const otherSum = aggregate.entries.slice(1).reduce((s, e) => s + e.hours, 0);
          const targetForNewest = Math.max(0, Math.round((nextHours - otherSum) * 100) / 100);
          if (targetForNewest <= 0) {
            await remove(newest.id);
          } else {
            await save(newest.id, { hours: targetForNewest });
          }
        } else if (nextHours > 0) {
          await create({
            issueId: issue.id,
            projectId: issue.projectId,
            spentOn: dayIso,
            hours: nextHours,
            activity,
            comments: '',
          });
        }
        setCellStatus((s) => ({ ...s, [key]: 'idle' }));
        void resource.reload();
      } catch {
        setCellStatus((s) => ({ ...s, [key]: 'error' }));
      }
    },
    [aggregates, create, save, remove, resource],
  );

  const weekHours = entries.reduce((sum, e) => sum + e.hours, 0);

  // Per-day totals across every project. Sums the user's entire week of
  // logged hours per day so the bottom summary bar shows "am I over or
  // under 8h today?" at a glance.
  const dailyTotals = useMemo(
    () => dayIsos.map((iso) => dayTotal(entries, iso)),
    [dayIsos, entries],
  );

  return (
    <main className="p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Timesheet</h1>
          <p className="text-sm text-ink-muted">
            Log hours per task per day. Auto-saves on blur.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full bg-canvas px-3 py-1 text-xs font-medium text-ink-muted"
            data-testid="timesheet-week-total"
          >
            Week total: <span className="tabular-nums text-ink">{formatCellHours(weekHours)}</span> h
          </span>
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setAnchorIso((p) => shiftWeeks(p, -1))}
              aria-label="Previous week"
              data-testid="timesheet-prev"
              className="grid h-9 w-9 place-items-center rounded-full border border-border-default text-ink-muted hover:bg-canvas"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setAnchorIso(isoDate(reference))}
              data-testid="timesheet-today"
              className="rounded-full border border-border-default px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted hover:bg-canvas"
            >
              This week
            </button>
            <button
              type="button"
              onClick={() => setAnchorIso((p) => shiftWeeks(p, 1))}
              aria-label="Next week"
              data-testid="timesheet-next"
              className="grid h-9 w-9 place-items-center rounded-full border border-border-default text-ink-muted hover:bg-canvas"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="mb-3 text-sm font-medium text-ink-soft" data-testid="timesheet-week-label">
        {weekLabel(week)}
      </div>

      {resource.loading && projectRows.length === 0 ? (
        <div className="flex items-center gap-2 p-6 text-sm text-ink-muted" data-testid="timesheet-loading">
          <Loader2 size={14} className="animate-spin" /> Loading timesheet…
        </div>
      ) : projectRows.length === 0 ? (
        <div
          className="rounded-lg border border-dashed border-border-default p-6 text-center text-sm text-ink-muted"
          data-testid="timesheet-empty"
        >
          No tasks are assigned to {user?.name ?? 'you'}.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {projectRows.map((row) => (
            <ProjectSection
              key={row.projectId}
              projectId={row.projectId}
              projectName={row.projectName}
              tasks={row.tasks}
              activities={activities}
              dayIsos={dayIsos}
              todayIso={todayIso}
              aggregates={aggregates}
              cellStatus={cellStatus}
              onCommit={onCellCommit}
            />
          ))}
        </div>
      )}

      <DailyTotalsBar
        dayIsos={dayIsos}
        totals={dailyTotals}
        weekTotal={weekHours}
        todayIso={todayIso}
      />
    </main>
  );
}

/**
 * Sticky summary at the bottom of the Timesheet. One column per day
 * with the user's total hours across every project, color-coded so
 * "am I over/under 8h today?" is a one-glance answer. The eighth
 * column is the weekly total.
 */
function DailyTotalsBar({
  dayIsos,
  totals,
  weekTotal,
  todayIso,
}: {
  dayIsos: string[];
  totals: number[];
  weekTotal: number;
  todayIso: string;
}) {
  return (
    <div
      className="sticky bottom-0 z-10 mt-6 -mx-6 border-t border-border-default bg-surface/95 px-6 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.15)] backdrop-blur"
      data-testid="timesheet-day-totals"
    >
      <div className="flex items-stretch gap-2">
        <div className="flex w-32 shrink-0 flex-col justify-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Daily total
          </div>
          <div className="text-[10px] text-ink-muted">All projects</div>
        </div>
        <div className="grid flex-1 grid-cols-7 gap-2">
          {dayIsos.map((iso, i) => {
            const d = new Date(iso + 'T00:00:00');
            const hours = totals[i] ?? 0;
            const isToday = iso === todayIso;
            return (
              <DailyTotalCell
                key={iso}
                label={`${WEEK_DAY_LABELS[i]} ${d.getDate()}`}
                hours={hours}
                isToday={isToday}
                testId={`timesheet-day-total-${iso}`}
              />
            );
          })}
        </div>
        <div className="flex w-20 shrink-0 flex-col items-end justify-center border-l border-border-muted pl-3">
          <div className="text-base font-semibold tabular-nums text-ink" data-testid="timesheet-week-grand-total">
            {formatCellHours(weekTotal)}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-ink-muted">Week</div>
        </div>
      </div>
    </div>
  );
}

const DAILY_TARGET_HOURS = 8;

function DailyTotalCell({
  label,
  hours,
  isToday,
  testId,
}: {
  label: string;
  hours: number;
  isToday: boolean;
  testId: string;
}) {
  // Color states:
  //   0h        → muted (no work logged yet)
  //   0 < h < 8 → amber (under target)
  //   h === 8   → emerald (on target)
  //   h > 8     → red (over target)
  let toneClass = 'text-ink-muted';
  let captionClass = 'text-ink-muted';
  let caption = '—';
  if (hours > 0 && hours < DAILY_TARGET_HOURS) {
    toneClass = 'text-amber-600';
    captionClass = 'text-amber-600';
    caption = `${(DAILY_TARGET_HOURS - hours).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}h under`;
  } else if (hours === DAILY_TARGET_HOURS) {
    toneClass = 'text-emerald-600';
    captionClass = 'text-emerald-600';
    caption = 'on target';
  } else if (hours > DAILY_TARGET_HOURS) {
    toneClass = 'text-red-600';
    captionClass = 'text-red-600';
    caption = `${(hours - DAILY_TARGET_HOURS).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}h over`;
  }
  return (
    <div
      className={
        'flex flex-col items-center justify-center rounded-md border px-2 py-1 ' +
        (isToday ? 'border-brand-400 bg-brand-50/30' : 'border-border-muted bg-canvas/40')
      }
      data-testid={testId}
    >
      <div className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</div>
      <div className={'text-base font-semibold tabular-nums ' + toneClass}>
        {hours > 0 ? formatCellHours(hours) : '—'}
      </div>
      <div className={'text-[10px] ' + captionClass}>{caption}</div>
    </div>
  );
}

interface ProjectSectionProps {
  projectId: number;
  projectName: string;
  tasks: Issue[];
  activities: string[];
  dayIsos: string[];
  todayIso: string;
  aggregates: Map<string, { hours: number; entries: TimeEntry[] }>;
  cellStatus: Record<string, CellStatus>;
  onCommit: (issue: Issue, dayIso: string, hours: number, activity: string | null) => void;
}

function ProjectSection({
  projectId,
  projectName,
  tasks,
  activities,
  dayIsos,
  todayIso,
  aggregates,
  cellStatus,
  onCommit,
}: ProjectSectionProps) {
  const { activity } = useProjectDefaultActivity(projectId);

  // Per-day totals for the project footer.
  const dayTotals = dayIsos.map((iso) =>
    tasks.reduce((sum, t) => {
      const agg = aggregates.get(cellKey(t.id, projectId, iso));
      return sum + (agg?.hours ?? 0);
    }, 0),
  );
  const projectTotal = dayTotals.reduce((s, h) => s + h, 0);

  return (
    <section
      className="card overflow-hidden"
      data-testid={`timesheet-project-${projectId}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default bg-canvas/40 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold leading-tight">{projectName}</div>
          <div className="text-xs text-ink-muted">
            {tasks.length} task{tasks.length === 1 ? '' : 's'} ·{' '}
            <span className="tabular-nums text-ink">{formatCellHours(projectTotal)}</span> h this week
          </div>
        </div>
        <ProjectActivityPicker
          projectId={projectId}
          activities={activities}
          testId={`timesheet-activity-${projectId}`}
        />
      </header>

      {!activity && (
        <div
          className="border-b border-border-muted bg-amber-500/10 px-4 py-2 text-xs text-amber-700"
          role="note"
          data-testid={`timesheet-activity-hint-${projectId}`}
        >
          Pick a default activity for this project to enable saving.
        </div>
      )}

      <div className="overflow-x-auto">
      <div
        className="grid min-w-[760px]"
        style={{
          gridTemplateColumns: 'minmax(220px, 1.4fr) repeat(7, minmax(64px, 1fr)) 72px',
        }}
      >
        <div className="bg-canvas/60 px-3 py-2 text-[11px] uppercase tracking-wide text-ink-muted">
          Task
        </div>
        {dayIsos.map((iso, i) => {
          const d = new Date(iso + 'T00:00:00');
          const isToday = iso === todayIso;
          return (
            <div
              key={iso}
              className={
                'border-l border-border-muted bg-canvas/60 px-2 py-2 text-center text-[11px] uppercase tracking-wide ' +
                (isToday ? 'text-brand-700' : 'text-ink-muted')
              }
            >
              {WEEK_DAY_LABELS[i]}
              <div className="text-[10px] font-normal normal-case tracking-normal text-ink-muted">
                {d.getDate()}
              </div>
            </div>
          );
        })}
        <div className="border-l border-border-muted bg-canvas/60 px-2 py-2 text-center text-[11px] uppercase tracking-wide text-ink-muted">
          Total
        </div>

        {tasks.map((task) => {
          const rowTotal = dayIsos.reduce(
            (sum, iso) => sum + (aggregates.get(cellKey(task.id, projectId, iso))?.hours ?? 0),
            0,
          );
          return (
            <Row
              key={task.id}
              task={task}
              dayIsos={dayIsos}
              todayIso={todayIso}
              aggregates={aggregates}
              cellStatus={cellStatus}
              defaultActivity={activity}
              rowTotal={rowTotal}
              onCommit={onCommit}
            />
          );
        })}

        <div className="border-t border-border-muted bg-canvas/30 px-3 py-2 text-xs font-medium text-ink-muted">
          Day total
        </div>
        {dayTotals.map((t, i) => (
          <div
            key={dayIsos[i]}
            className="border-l border-t border-border-muted bg-canvas/30 px-2 py-2 text-right text-xs tabular-nums text-ink"
          >
            {t > 0 ? formatCellHours(t) : '—'}
          </div>
        ))}
        <div className="border-l border-t border-border-muted bg-canvas/30 px-2 py-2 text-right text-xs font-semibold tabular-nums text-ink">
          {projectTotal > 0 ? formatCellHours(projectTotal) : '—'}
        </div>
      </div>
      </div>
    </section>
  );
}

interface RowProps {
  task: Issue;
  dayIsos: string[];
  todayIso: string;
  aggregates: Map<string, { hours: number; entries: TimeEntry[] }>;
  cellStatus: Record<string, CellStatus>;
  defaultActivity: string | null;
  rowTotal: number;
  onCommit: (issue: Issue, dayIso: string, hours: number, activity: string | null) => void;
}

function Row({ task, dayIsos, todayIso, aggregates, cellStatus, defaultActivity, rowTotal, onCommit }: RowProps) {
  return (
    <>
      <div className="flex min-w-0 flex-col justify-center gap-0.5 border-t border-border-muted bg-surface px-3 py-2 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <a
            href={`/issues/${task.id}`}
            onClick={(e) => e.preventDefault()}
            className="block min-w-0 truncate font-medium text-ink"
            title={task.subject}
          >
            #{task.id} · {task.subject}
          </a>
        </div>
        <div className="flex min-w-0 items-center gap-2 truncate text-[11px] text-ink-muted">
          <span>{task.status}</span>
          {task.dueDate && <span>· due {task.dueDate}</span>}
          {task.estimatedHours !== null && (
            <span>· est {formatCellHours(task.estimatedHours)} h</span>
          )}
        </div>
      </div>
      {dayIsos.map((iso) => {
        const d = new Date(iso + 'T00:00:00');
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const isToday = iso === todayIso;
        const key = cellKey(task.id, task.projectId, iso);
        const agg = aggregates.get(key);
        return (
          <div
            key={iso}
            className="border-l border-t border-border-muted bg-surface"
          >
            <TimesheetCell
              testId={`timesheet-cell-${task.id}-${iso}`}
              hours={agg?.hours ?? 0}
              entries={agg?.entries ?? []}
              isToday={isToday}
              isWeekend={isWeekend}
              status={cellStatus[key] ?? 'idle'}
              disabled={!defaultActivity}
              disabledReason="Pick a default activity for this project to enable saving."
              onCommit={(nextHours) => onCommit(task, iso, nextHours, defaultActivity)}
            />
          </div>
        );
      })}
      <div className="border-l border-t border-border-muted bg-surface px-2 py-2 text-right text-sm font-medium tabular-nums text-ink">
        {rowTotal > 0 ? formatCellHours(rowTotal) : '—'}
      </div>
    </>
  );
}
