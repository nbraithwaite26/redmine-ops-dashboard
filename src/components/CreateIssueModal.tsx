import { useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';
import { getPriorities, getProjects, getTrackers } from '../services/redmineApi';
import type { Issue, IssuePriority, Project, Tracker } from '../types/redmine';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { useIssueActions } from '../hooks/useIssueActions';
import { useReadOnly } from '../hooks/useReadOnly';

interface Props {
  onClose: () => void;
  /** Fires with the newly-created issue after a successful create. */
  onCreated: (issue: Issue) => void;
  /** Pre-select the project dropdown to this id when the modal opens. */
  initialProjectId?: number;
}

/**
 * "New issue" dialog. Currently launched from the Tasks page header.
 *
 * Required fields: project + subject. Tracker / priority / description /
 * due date are optional and have sensible defaults at the backend
 * (Redmine picks the project's default tracker if none specified).
 *
 * Save flow:
 *   - useIssueActions.create(input) — toast on success or error
 *   - On success, onCreated(issue) is called so the caller can update
 *     its list and route the user into the new issue
 */
export default function CreateIssueModal({
  onClose,
  onCreated,
  initialProjectId,
}: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [priorities, setPriorities] = useState<IssuePriority[]>([]);

  const [projectId, setProjectId] = useState<number | null>(initialProjectId ?? null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [tracker, setTracker] = useState<Tracker | ''>('');
  const [priority, setPriority] = useState<IssuePriority | ''>('');
  const [dueDate, setDueDate] = useState<string>('');

  const { saving, create } = useIssueActions();
  const { readOnly } = useReadOnly();
  const dialogRef = useDialogA11y({ open: true, onClose });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [projectList, trackerList, priorityList] = await Promise.all([
        getProjects(),
        getTrackers(),
        getPriorities(),
      ]);
      if (cancelled) return;
      setProjects(projectList);
      setTrackers(trackerList as Tracker[]);
      setPriorities(priorityList as IssuePriority[]);
      if (projectId === null && projectList.length > 0) {
        setProjectId(projectList[0]!.id);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Run once on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSubmit =
    projectId !== null && subject.trim().length > 0 && !saving && !readOnly;

  const save = async () => {
    if (!canSubmit || projectId === null) return;
    try {
      const issue = await create({
        projectId,
        subject: subject.trim(),
        description: description || undefined,
        tracker: tracker || undefined,
        priority: priority || undefined,
        dueDate: dueDate || undefined,
      });
      onCreated(issue);
      onClose();
    } catch {
      // Toast surfaced by the hook; modal stays open.
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-issue-title"
    >
      <div
        ref={dialogRef}
        className="bg-white w-[640px] max-w-[95vw] max-h-[90vh] overflow-y-auto rounded-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div id="create-issue-title" className="font-semibold">
            New issue
          </div>
          <button onClick={onClose} aria-label="Close new issue">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <label className="sm:col-span-2">
            <div className="text-xs text-ink-muted mb-1">
              Subject <span className="text-red-700">*</span>
            </div>
            <input
              className="modal-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of the work"
              autoFocus
              data-testid="create-issue-subject"
            />
          </label>

          <label>
            <div className="text-xs text-ink-muted mb-1">
              Project <span className="text-red-700">*</span>
            </div>
            <select
              className="modal-input"
              value={projectId ?? ''}
              onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}
              data-testid="create-issue-project"
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
            <div className="text-xs text-ink-muted mb-1">Tracker</div>
            <select
              className="modal-input"
              value={tracker}
              onChange={(e) => setTracker(e.target.value as Tracker)}
              data-testid="create-issue-tracker"
            >
              <option value="">— Project default —</option>
              {trackers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div className="text-xs text-ink-muted mb-1">Priority</div>
            <select
              className="modal-input"
              value={priority}
              onChange={(e) => setPriority(e.target.value as IssuePriority)}
              data-testid="create-issue-priority"
            >
              <option value="">— Default —</option>
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div className="text-xs text-ink-muted mb-1">Due date</div>
            <input
              type="date"
              className="modal-input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              data-testid="create-issue-due"
            />
          </label>

          <label className="sm:col-span-2">
            <div className="text-xs text-ink-muted mb-1">Description</div>
            <textarea
              className="modal-input"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional context for the assignee"
              data-testid="create-issue-description"
            />
          </label>
        </div>

        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-brand"
            onClick={save}
            disabled={!canSubmit}
            title={readOnly ? 'Read-only mode — writes disabled' : undefined}
            data-testid="create-issue-save"
          >
            <Save size={14} /> {saving ? 'Creating…' : 'Create issue'}
          </button>
        </div>
      </div>
    </div>
  );
}
