import { useProjectDefaultActivity } from '../hooks/useProjectDefaultActivity';

interface Props {
  projectId: number;
  activities: string[];
  /** Sorting/curation already done upstream — caller chooses the order. */
  testId?: string;
}

/**
 * Per-project dropdown that picks the default time-entry activity. The
 * timesheet uses this to auto-attach `activity` on every cell save without
 * prompting the user per row. Selection is persisted per (workspace,
 * project) via `useProjectDefaultActivity`.
 */
export default function ProjectActivityPicker({ projectId, activities, testId }: Props) {
  const { activity, setActivity } = useProjectDefaultActivity(projectId);

  return (
    <label className="flex items-center gap-2 text-xs text-ink-muted" data-testid={testId}>
      <span className="uppercase tracking-wide">Activity</span>
      <select
        value={activity ?? ''}
        onChange={(e) => setActivity(e.currentTarget.value || null)}
        className="rounded-md border border-border-default bg-canvas px-2 py-1 text-xs text-ink"
        data-testid={testId ? `${testId}-select` : undefined}
      >
        <option value="">— pick activity —</option>
        {activities.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </label>
  );
}
