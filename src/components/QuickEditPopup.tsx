import { useEffect, useState } from 'react';
import { CalendarClock, ExternalLink, Save, Timer, X } from 'lucide-react';
import type { Issue, IssuePriority, IssueStatus } from '../types/redmine';
import {
  mockIssueStatuses,
  mockPriorities,
  mockTimeActivities,
  mockUsers,
} from '../data/mockData';
import { createTimeEntry } from '../services/redmineApi';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { useReadOnly } from '../hooks/useReadOnly';
import { useIssueActions } from '../hooks/useIssueActions';

interface Props {
  issue: Issue;
  onClose: () => void;
  onSaved: (issue: Issue) => void;
  onOpenFullEditor?: (issue: Issue) => void;
}

interface DraftTimeEntry {
  hours: string;
  activity: string;
  comments: string;
  spentOn: string;
}

export default function QuickEditPopup({ issue, onClose, onSaved, onOpenFullEditor }: Props) {
  const [draft, setDraft] = useState<Issue>(issue);
  const [timeDraft, setTimeDraft] = useState<DraftTimeEntry>({
    hours: '',
    activity: 'Development',
    comments: '',
    spentOn: new Date().toISOString().slice(0, 10),
  });
  const { saving, save: saveIssue } = useIssueActions();
  const { readOnly } = useReadOnly();

  useEffect(() => setDraft(issue), [issue]);

  const save = async (alsoLogTime: boolean) => {
    try {
      const updated = await saveIssue(issue.id, draft);
      if (alsoLogTime && Number(timeDraft.hours) > 0) {
        await createTimeEntry({
          projectId: updated.projectId,
          issueId: updated.id,
          hours: Number(timeDraft.hours),
          activity: timeDraft.activity,
          comments: timeDraft.comments,
          spentOn: timeDraft.spentOn,
        });
      }
      onSaved(updated);
      onClose();
    } catch {
      // Toast already surfaced by useSaveIssue. Keep the popup open so the
      // user can fix and retry.
    }
  };

  const dialogRef = useDialogA11y({ open: true, onClose });

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-edit-title"
    >
      <div
        ref={dialogRef}
        className="bg-white w-[600px] max-w-[95vw] rounded-xl shadow-xl border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div>
            <div className="text-xs text-ink-muted">Quick edit</div>
            <div id="quick-edit-title" className="font-semibold">
              <a className="link" href={`#/tasks?id=${issue.id}`}>#{issue.id}</a> · {issue.subject}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close quick edit">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <Field label="Status">
            <select
              className="input"
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as IssueStatus })}
            >
              {mockIssueStatuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select
              className="input"
              value={draft.priority}
              onChange={(e) => setDraft({ ...draft, priority: e.target.value as IssuePriority })}
            >
              {mockPriorities.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Assignee">
            <select
              className="input"
              value={draft.assignee?.id ?? ''}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  assignee:
                    e.target.value === ''
                      ? null
                      : mockUsers.find((u) => u.id === Number(e.target.value)) ?? null,
                })
              }
            >
              <option value="">Unassigned</option>
              {mockUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Due Date">
            <input
              type="date"
              className="input"
              value={draft.dueDate ?? ''}
              onChange={(e) => setDraft({ ...draft, dueDate: e.target.value || null })}
            />
          </Field>
          <Field label="Estimated Hours">
            <input
              type="number"
              min={0}
              step={0.25}
              className="input"
              value={draft.estimatedHours ?? 0}
              onChange={(e) =>
                setDraft({ ...draft, estimatedHours: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field label="% Done">
            <input
              type="number"
              min={0}
              max={100}
              step={5}
              className="input"
              value={draft.doneRatio}
              onChange={(e) => setDraft({ ...draft, doneRatio: Number(e.target.value) })}
            />
          </Field>
          <Field label="Next Action" full>
            <input
              type="text"
              className="input"
              value={draft.nextAction ?? ''}
              onChange={(e) => setDraft({ ...draft, nextAction: e.target.value || null })}
              placeholder="What's the next concrete step?"
            />
          </Field>
          <Field label="Short comment" full>
            <textarea
              className="input"
              rows={2}
              placeholder="Optional comment — added to the issue journal."
            />
          </Field>
        </div>

        <div className="px-5 py-4 border-t bg-canvas">
          <div className="text-sm font-semibold text-ink mb-2 flex items-center gap-2">
            <Timer size={14} /> Log time
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Field label="Date">
              <input
                type="date"
                className="input"
                value={timeDraft.spentOn}
                onChange={(e) => setTimeDraft({ ...timeDraft, spentOn: e.target.value })}
              />
            </Field>
            <Field label="Hours">
              <input
                type="number"
                step={0.25}
                min={0}
                className="input"
                value={timeDraft.hours}
                onChange={(e) => setTimeDraft({ ...timeDraft, hours: e.target.value })}
                placeholder="0.0"
              />
            </Field>
            <Field label="Activity">
              <select
                className="input"
                value={timeDraft.activity}
                onChange={(e) => setTimeDraft({ ...timeDraft, activity: e.target.value })}
              >
                {mockTimeActivities.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </Field>
            <Field label="Comment">
              <input
                type="text"
                className="input"
                value={timeDraft.comments}
                onChange={(e) => setTimeDraft({ ...timeDraft, comments: e.target.value })}
              />
            </Field>
          </div>
        </div>

        <div className="px-5 py-3 border-t flex items-center justify-between">
          <button
            className="btn-ghost text-sm"
            onClick={() => onOpenFullEditor?.(issue)}
          >
            <ExternalLink size={14} /> Open full ticket editor
          </button>
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="btn-secondary"
              onClick={() => save(true)}
              disabled={saving || readOnly}
              title={readOnly ? 'Read-only mode — writes disabled' : undefined}
            >
              <CalendarClock size={14} /> Save and log time
            </button>
            <button
              className="btn-brand"
              onClick={() => save(false)}
              disabled={saving || readOnly}
              title={readOnly ? 'Read-only mode — writes disabled' : undefined}
            >
              <Save size={14} /> Save quick edit
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={full ? 'sm:col-span-2 block' : 'block'}>
      <div className="text-xs text-ink-muted mb-1">{label}</div>
      {children}
    </label>
  );
}
