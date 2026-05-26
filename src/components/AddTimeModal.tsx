import { useEffect, useMemo, useState } from 'react';
import { Save, X } from 'lucide-react';
import {
  getIssueById,
  getIssues,
  getProjects,
  getTimeActivities,
  getTimeEntries,
} from '../services/redmineApi';
import type { Issue, Project, TimeEntry } from '../types/redmine';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { useTimeEntryActions } from '../hooks/useTimeEntryActions';
import { useIssueActions } from '../hooks/useIssueActions';
import { useReadOnly } from '../hooks/useReadOnly';
import { formatHours } from '../lib/format';

interface Props {
  onClose: () => void;
  /** Fires after either a successful create OR a successful update. */
  onCreated: () => void;
  /** Pre-select the project dropdown to this id when the modal opens. */
  initialProjectId?: number;
  /**
   * Pre-select the task dropdown to this id when the modal opens. Implies
   * the issue's project — `initialProjectId` is inferred from it if not
   * supplied separately.
   */
  initialIssueId?: number;
  /**
   * When provided, the modal opens in EDIT mode: every field hydrates
   * from this entry, the title flips to "Edit time entry", and Save
   * calls update instead of create. The "New → In Progress" status
   * bump only applies to creates and is skipped here.
   */
  editing?: TimeEntry;
}

/**
 * "Add time entry" dialog. Launched from the TimeTracking page and from
 * each task row on the Hours page.
 *
 * Behavior contract (plan §1 — Add Time Entry):
 *   - Project dropdown sourced from real Redmine projects via getProjects().
 *   - Task/issue dropdown auto-populates with the selected project's
 *     issues. Switching the project resets the issue selection.
 *   - No user dropdown — entries are always logged by the current user.
 *   - When a task is selected, the modal shows a small list of that
 *     task's existing time entries below the form ("Previous logs").
 *   - After a successful save, if the selected task had status === 'New',
 *     it's bumped to 'In Progress' best-effort. Failing the bump still
 *     counts the time log as a success.
 */
export default function AddTimeModal({
  onClose,
  onCreated,
  initialProjectId,
  initialIssueId,
  editing,
}: Props) {
  const editMode = editing !== undefined;

  // ─── State ──────────────────────────────────────────────────────────────

  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<string[]>([]);
  const [issuesForProject, setIssuesForProject] = useState<Issue[]>([]);
  const [pastEntries, setPastEntries] = useState<TimeEntry[]>([]);

  const [projectId, setProjectId] = useState<number | null>(
    editing?.projectId ?? initialProjectId ?? null,
  );
  const [issueId, setIssueId] = useState<number | null>(
    editing?.issueId ?? initialIssueId ?? null,
  );
  const [activity, setActivity] = useState<string>(editing?.activity ?? '');
  const [hours, setHours] = useState(editing ? String(editing.hours) : '');
  const [spentOn, setSpentOn] = useState(
    editing?.spentOn ?? new Date().toISOString().slice(0, 10),
  );
  const [comments, setComments] = useState(editing?.comments ?? '');

  const { saving, create, save: updateEntry } = useTimeEntryActions();
  const issueActions = useIssueActions();
  const { readOnly } = useReadOnly();

  // ─── Initial load: projects, activities, and (if pre-seeded) the issue's
  //                   project so the dropdowns hydrate correctly ───────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [projectList, activityList] = await Promise.all([
        getProjects(),
        getTimeActivities(),
      ]);
      if (cancelled) return;
      setProjects(projectList);
      setActivities(activityList);
      if (activityList.length > 0) setActivity((cur) => cur || activityList[0]!);

      // If we got an initialIssueId without a project, look it up and seed
      // the project dropdown from there.
      if (initialIssueId && !initialProjectId) {
        const issue = await getIssueById(initialIssueId);
        if (cancelled) return;
        if (issue) setProjectId(issue.projectId);
      } else if (projectId === null && projectList.length > 0) {
        setProjectId(projectList[0]!.id);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Run once on open — pre-seed props are captured at mount time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── When the project changes, refresh the task list ───────────────────

  useEffect(() => {
    if (projectId === null) {
      setIssuesForProject([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const all = await getIssues();
      if (cancelled) return;
      setIssuesForProject(all.filter((i) => i.projectId === projectId));
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // ─── When the issue changes, refresh the past-entries panel ────────────

  useEffect(() => {
    if (issueId === null) {
      setPastEntries([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const entries = await getTimeEntries({ issueId });
      if (cancelled) return;
      // Newest first.
      setPastEntries(
        [...entries].sort((a, b) => (b.spentOn > a.spentOn ? 1 : b.spentOn < a.spentOn ? -1 : 0)),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [issueId]);

  // ─── Save handler ──────────────────────────────────────────────────────

  const save = async () => {
    if (projectId === null) return;
    const payload = {
      projectId,
      issueId,
      activity,
      hours: Number(hours) || 0,
      spentOn,
      comments,
    };

    try {
      if (editMode) {
        await updateEntry(editing!.id, payload);
      } else {
        await create(payload);
      }
    } catch {
      // Toast already surfaced; keep the modal open for retry.
      return;
    }

    // Status-bump only on CREATE. Edits shouldn't auto-bump an issue's
    // status — the user already knows the state of the world.
    if (!editMode && issueId !== null) {
      try {
        const issue = await getIssueById(issueId);
        if (issue && issue.status === 'New') {
          await issueActions.save(issue.id, { status: 'In Progress' });
        }
      } catch {
        // Toast surfaces from the hook; the create itself was fine.
      }
    }

    onCreated();
    onClose();
  };

  const dialogRef = useDialogA11y({ open: true, onClose });

  // ─── Derived ────────────────────────────────────────────────────────────

  const pastEntriesSummary = useMemo(() => {
    const total = pastEntries.reduce((s, e) => s + e.hours, 0);
    return { count: pastEntries.length, total };
  }, [pastEntries]);

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-time-title"
    >
      <div
        ref={dialogRef}
        className="bg-white w-[640px] max-w-[95vw] max-h-[90vh] overflow-y-auto rounded-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div id="add-time-title" className="font-semibold">
            {editMode ? 'Edit time entry' : 'Add time entry'}
          </div>
          <button onClick={onClose} aria-label="Close add time">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <label>
            <div className="text-xs text-ink-muted mb-1">
              Date <span className="text-ink-muted">(defaults to today)</span>
            </div>
            <input
              type="date"
              className="modal-input"
              value={spentOn}
              onChange={(e) => setSpentOn(e.target.value)}
              data-testid="add-time-date"
            />
          </label>
          <label>
            <div className="text-xs text-ink-muted mb-1">Hours</div>
            <input
              type="number"
              step={0.25}
              min={0}
              className="modal-input"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="0.0"
              data-testid="add-time-hours"
            />
          </label>
          <label>
            <div className="text-xs text-ink-muted mb-1">Project</div>
            <select
              className="modal-input"
              value={projectId ?? ''}
              onChange={(e) => {
                setProjectId(e.target.value ? Number(e.target.value) : null);
                setIssueId(null); // reset the dependent task selection
              }}
              data-testid="add-time-project"
            >
              {projects.length === 0 && <option value="">Loading…</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="text-xs text-ink-muted mb-1">Task</div>
            <select
              className="modal-input"
              value={issueId ?? ''}
              onChange={(e) => setIssueId(e.target.value ? Number(e.target.value) : null)}
              disabled={projectId === null}
              data-testid="add-time-task"
            >
              <option value="">— None (project-level entry) —</option>
              {issuesForProject.map((i) => (
                <option key={i.id} value={i.id}>
                  #{i.id} {i.subject}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="text-xs text-ink-muted mb-1">Activity</div>
            <select
              className="modal-input"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              data-testid="add-time-activity"
            >
              {activities.length === 0 && <option value="">Loading…</option>}
              {activities.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-1">
            <div className="text-xs text-ink-muted mb-1">Comment</div>
            <input
              className="modal-input"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              data-testid="add-time-comment"
            />
          </label>
        </div>

        {issueId !== null && (
          <section
            className="px-5 pb-4 border-t pt-4"
            data-testid="past-entries-panel"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs uppercase tracking-wide text-ink-muted">
                Previous logs on this task
              </h3>
              {pastEntriesSummary.count > 0 && (
                <span className="text-xs text-ink-muted">
                  {pastEntriesSummary.count}{' '}
                  {pastEntriesSummary.count === 1 ? 'entry' : 'entries'} ·{' '}
                  {formatHours(pastEntriesSummary.total)}
                </span>
              )}
            </div>
            {pastEntries.length === 0 ? (
              <p
                className="text-xs text-ink-muted"
                data-testid="past-entries-empty"
              >
                No time has been logged on this task yet.
              </p>
            ) : (
              <ul className="space-y-1 max-h-32 overflow-y-auto">
                {pastEntries.slice(0, 8).map((e) => (
                  <li
                    key={e.id}
                    data-testid={`past-entry-${e.id}`}
                    className="flex items-center gap-3 text-xs"
                  >
                    <span className="text-ink-muted w-20 tabular-nums">{e.spentOn}</span>
                    <span className="flex-1 truncate">{e.user.name}</span>
                    <span className="text-ink-muted truncate flex-1">
                      {e.activity || '—'}
                    </span>
                    <span className="font-medium tabular-nums w-12 text-right">
                      {formatHours(e.hours)}
                    </span>
                  </li>
                ))}
                {pastEntries.length > 8 && (
                  <li className="text-[11px] text-ink-muted">
                    + {pastEntries.length - 8} older…
                  </li>
                )}
              </ul>
            )}
          </section>
        )}

        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-brand"
            onClick={save}
            disabled={saving || readOnly || projectId === null}
            title={readOnly ? 'Read-only mode — writes disabled' : undefined}
            data-testid="add-time-save"
          >
            <Save size={14} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
