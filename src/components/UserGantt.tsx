import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, CalendarRange } from 'lucide-react';
import clsx from 'clsx';
import type { Issue, User } from '../types/redmine';
import { formatHours } from '../lib/format';

interface Props {
  /** Candidate engineers (derived from assignees upstream). */
  users: User[];
  /** All team issues; filtered to the selected user here. */
  issues: Issue[];
}

interface ProjectGroup {
  projectId: number;
  projectName: string;
  tasks: Issue[];
  /** Earliest task start / latest task due across dated tasks, or null. */
  start: string | null;
  end: string | null;
}

function spanOf(tasks: Issue[]): { start: string | null; end: string | null } {
  let start: string | null = null;
  let end: string | null = null;
  for (const t of tasks) {
    if (t.startDate && (start === null || t.startDate < start)) start = t.startDate;
    if (t.dueDate && (end === null || t.dueDate > end)) end = t.dueDate;
  }
  return { start, end };
}

/** Percent offset of a date within [domainStart, domainEnd]. */
function pct(date: string, domainStart: number, domainEnd: number): number {
  const t = new Date(date).getTime();
  if (domainEnd <= domainStart) return 0;
  return ((t - domainStart) / (domainEnd - domainStart)) * 100;
}

/**
 * Select-an-engineer-first Gantt. Shows nothing until a user is picked, then
 * renders only that user's work, grouped Project → Tasks, with each bar
 * positioned start→due. CR #18 item 7 — also avoids the prior all-rows render.
 */
export default function UserGantt({ users, issues }: Props) {
  const [selectedId, setSelectedId] = useState<number | ''>('');
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );

  const userIssues = useMemo(
    () => (selectedId === '' ? [] : issues.filter((i) => i.assignee?.id === selectedId)),
    [issues, selectedId],
  );

  const groups: ProjectGroup[] = useMemo(() => {
    const byProject = new Map<number, ProjectGroup>();
    for (const i of userIssues) {
      let g = byProject.get(i.projectId);
      if (!g) {
        g = { projectId: i.projectId, projectName: i.projectName, tasks: [], start: null, end: null };
        byProject.set(i.projectId, g);
      }
      g.tasks.push(i);
    }
    const out = Array.from(byProject.values());
    for (const g of out) {
      const s = spanOf(g.tasks);
      g.start = s.start;
      g.end = s.end;
    }
    return out.sort((a, b) => a.projectName.localeCompare(b.projectName));
  }, [userIssues]);

  // Timeline domain across all the user's dated tasks.
  const domain = useMemo(() => {
    const s = spanOf(userIssues);
    if (!s.start || !s.end) return null;
    const start = new Date(s.start).getTime();
    // Ensure a non-zero width even if start === end.
    const end = Math.max(new Date(s.end).getTime(), start + 86_400_000);
    return { start, end, startLabel: s.start, endLabel: s.end };
  }, [userIssues]);

  const datedCount = userIssues.filter((i) => i.startDate && i.dueDate).length;

  function Bar({ start, end, tone }: { start: string; end: string; tone: 'project' | 'task' }) {
    if (!domain) return null;
    const left = pct(start, domain.start, domain.end);
    const right = pct(end, domain.start, domain.end);
    const width = Math.max(2, right - left); // min 2% so a same-day task shows
    return (
      <div className="relative h-5">
        <div
          className={clsx(
            'absolute top-0.5 h-4 rounded',
            tone === 'project' ? 'bg-blue-500/80' : 'bg-emerald-500/80',
          )}
          style={{ left: `${left}%`, width: `${width}%` }}
          title={`${start} → ${end}`}
        />
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 flex flex-wrap items-center gap-3 border-b">
        <div className="font-semibold flex items-center gap-2">
          <CalendarRange size={16} className="text-ink-muted" /> Engineer schedule
        </div>
        <label className="text-sm ml-auto">
          <span className="sr-only">Select engineer</span>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : '')}
            className="border border-gray-200 bg-white rounded px-2 py-1 text-sm max-w-[60vw] sm:max-w-[260px]"
            aria-label="Select engineer"
            data-testid="gantt-user-select"
          >
            <option value="">Select an engineer…</option>
            {sortedUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </label>
      </div>

      {selectedId === '' ? (
        <div className="p-10 text-center text-sm text-ink-muted" data-testid="gantt-empty">
          Select an engineer to see their schedule.
        </div>
      ) : datedCount === 0 ? (
        <div className="p-10 text-center text-sm text-ink-muted" data-testid="gantt-no-dates">
          No scheduled work with start and due dates for this engineer.
        </div>
      ) : (
        <div>
          {domain && (
            <div className="flex items-center justify-between px-4 py-1.5 text-[11px] text-ink-muted border-b bg-canvas/40">
              <span>{domain.startLabel}</span>
              <span>{domain.endLabel}</span>
            </div>
          )}
          {groups.map((g) => {
            const isCollapsed = collapsed[g.projectId] ?? false;
            return (
              <div key={g.projectId} className="border-b border-gray-100 last:border-b-0">
                <div className="grid grid-cols-[minmax(180px,300px)_1fr] items-center gap-3 px-4 py-1.5">
                  <button
                    type="button"
                    onClick={() => setCollapsed((p) => ({ ...p, [g.projectId]: !isCollapsed }))}
                    className="flex items-center gap-1 text-left text-sm font-medium truncate"
                    aria-expanded={!isCollapsed}
                    data-testid={`gantt-project-${g.projectId}`}
                  >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    <span className="truncate">{g.projectName}</span>
                    <span className="text-xs text-ink-muted shrink-0">({g.tasks.length})</span>
                  </button>
                  {g.start && g.end ? (
                    <Bar start={g.start} end={g.end} tone="project" />
                  ) : (
                    <div className="h-5 text-[11px] text-ink-muted flex items-center">No dates</div>
                  )}
                </div>

                {!isCollapsed &&
                  g.tasks.map((t) => (
                    <div
                      key={t.id}
                      className="grid grid-cols-[minmax(180px,300px)_1fr] items-center gap-3 px-4 py-1 bg-canvas/30"
                    >
                      <div className="pl-5 text-xs truncate">
                        <a className="link" href={`#/tasks?id=${t.id}`}>#{t.id}</a>{' '}
                        {t.subject}
                        {t.estimatedHours != null && (
                          <span className="text-ink-muted"> · {formatHours(t.estimatedHours)} est</span>
                        )}
                      </div>
                      {t.startDate && t.dueDate ? (
                        <Bar start={t.startDate} end={t.dueDate} tone="task" />
                      ) : (
                        <div className="h-5 text-[11px] text-ink-muted flex items-center">No dates</div>
                      )}
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
