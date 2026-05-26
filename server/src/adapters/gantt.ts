import type { NormalizedIssue, GanttRow } from '../types/normalized.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface BuildGanttOptions {
  /** Pinned "today" for tests. Defaults to new Date(). */
  today?: Date;
  /** Per-assignee capacity in hours over the window of overlapping work. */
  capacityHours?: number;
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Builds Gantt rows from normalized issues.
 *
 *   - isAtRisk: dueDate < today && doneRatio < 100 && not closed
 *   - isOverloaded: per assignee, sum of estimated_hours across issues whose
 *     date range overlaps another issue's range exceeds capacityHours.
 */
export function buildGanttRows(
  issues: NormalizedIssue[],
  options: BuildGanttOptions = {},
): GanttRow[] {
  const today = options.today ?? new Date();
  const capacityHours = options.capacityHours ?? 40;

  // Group issues by assignee to compute overloaded flag.
  const byAssignee = new Map<number, NormalizedIssue[]>();
  for (const issue of issues) {
    const key = issue.assignee?.id ?? -1;
    const bucket = byAssignee.get(key) ?? [];
    bucket.push(issue);
    byAssignee.set(key, bucket);
  }

  const overloadedAssignees = new Set<number>();
  for (const [assigneeId, list] of byAssignee) {
    if (assigneeId === -1) continue; // unassigned: don't flag
    let overlappingHours = 0;
    for (let i = 0; i < list.length; i++) {
      const a = list[i]!;
      const aStart = parseDate(a.startDate);
      const aEnd = parseDate(a.dueDate);
      if (!aStart || !aEnd) continue;
      let countA = false;
      for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        const b = list[j]!;
        const bStart = parseDate(b.startDate);
        const bEnd = parseDate(b.dueDate);
        if (!bStart || !bEnd) continue;
        if (overlaps(aStart, aEnd, bStart, bEnd)) {
          countA = true;
          break;
        }
      }
      if (countA) overlappingHours += a.estimatedHours ?? 0;
    }
    if (overlappingHours > capacityHours) overloadedAssignees.add(assigneeId);
  }

  return issues.map<GanttRow>((issue) => {
    const due = parseDate(issue.dueDate);
    const isAtRisk =
      due !== null &&
      due.getTime() < today.getTime() - ONE_DAY_MS &&
      issue.doneRatio < 100 &&
      issue.status.toLowerCase() !== 'closed' &&
      issue.status.toLowerCase() !== 'resolved';
    return {
      id: issue.id,
      issueId: issue.id,
      projectId: issue.projectId,
      projectName: issue.projectName,
      subject: issue.subject,
      tracker: issue.tracker,
      status: issue.status,
      assigneeId: issue.assignee?.id ?? null,
      assigneeName: issue.assignee?.name ?? null,
      startDate: issue.startDate,
      dueDate: issue.dueDate,
      estimatedHours: issue.estimatedHours,
      spentHours: issue.spentHours,
      doneRatio: issue.doneRatio,
      parentIssueId: issue.parentIssueId,
      children: issue.children,
      relations: issue.relations,
      isOverloaded:
        issue.assignee !== null && overloadedAssignees.has(issue.assignee.id),
      isAtRisk,
    };
  });
}
