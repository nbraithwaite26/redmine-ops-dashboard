import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageSquare,
  Plus,
  Save,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import { useDialogA11y } from '../hooks/useDialogA11y';
import type { CustomField, Issue, IssuePriority, IssueStatus, Tracker } from '../types/redmine';
import {
  mockIssueStatuses,
  mockPriorities,
  mockProjects,
  mockTrackers,
  mockUsers,
} from '../data/mockData';
import { useReadOnly } from '../hooks/useReadOnly';
import { useIssueActions } from '../hooks/useIssueActions';

interface Props {
  issue: Issue;
  onClose: () => void;
  onSaved: (issue: Issue) => void;
  /**
   * Fires after a successful delete. When provided, the drawer renders a
   * Delete affordance in the footer; the parent is expected to refresh
   * its list and clear any "open issue" state.
   */
  onDeleted?: (id: number) => void;
  onQuickEdit?: (issue: Issue) => void;
}

export default function TicketDrawer({ issue, onClose, onSaved, onDeleted, onQuickEdit }: Props) {
  const [draft, setDraft] = useState<Issue>(issue);
  const [comment, setComment] = useState('');
  const [subtaskOpen, setSubtaskOpen] = useState(false);
  const [subtaskSubject, setSubtaskSubject] = useState('');
  const actions = useIssueActions();
  const { saving } = actions;
  const { readOnly } = useReadOnly();

  useEffect(() => setDraft(issue), [issue]);

  const postComment = async () => {
    const body = comment.trim();
    if (!body) return;
    try {
      await actions.comment(issue.id, body);
      setComment('');
    } catch {
      // Toast surfaced by the hook; keep the textarea contents for retry.
    }
  };

  const addSubtask = async () => {
    const subject = subtaskSubject.trim();
    if (!subject) return;
    try {
      await actions.addSubtaskFor(issue.id, {
        projectId: issue.projectId,
        subject,
      });
      setSubtaskSubject('');
      setSubtaskOpen(false);
    } catch {
      // Toast surfaced; keep the input open so the user can fix and retry.
    }
  };

  const save = async () => {
    try {
      const updated = await actions.save(issue.id, draft);
      onSaved(updated);
    } catch {
      // Toast surfaced by useIssueActions; keep the drawer open for retry.
    }
  };

  const handleDelete = async () => {
    if (!onDeleted) return;
    // Browser confirm is fine for the pattern; can swap to a styled modal
    // in a polish pass.
    const ok =
      typeof window !== 'undefined' &&
      window.confirm(`Delete issue #${issue.id}? This can't be undone.`);
    if (!ok) return;
    try {
      await actions.remove(issue.id);
      onClose();
      onDeleted(issue.id);
    } catch {
      // Toast surfaced; keep the drawer open.
    }
  };

  const dialogRef = useDialogA11y({ open: true, onClose });

  return (
    <div
      className="fixed inset-0 z-30 flex justify-end bg-black/30"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-drawer-title"
    >
      <div
        ref={dialogRef}
        className="w-full sm:w-[640px] sm:max-w-full h-full bg-white shadow-drawer flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div>
            <div className="text-xs text-ink-muted">
              {draft.tracker} · {draft.projectName}
            </div>
            <div id="ticket-drawer-title" className="font-semibold text-lg">
              #{draft.id} · {draft.subject}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close drawer">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
          <Section title="Overview">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="Subject" full>
                <input
                  className="input"
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                />
              </F>
              <F label="Project">
                <select
                  className="input"
                  value={draft.projectId}
                  onChange={(e) => {
                    const proj = mockProjects.find((p) => p.id === Number(e.target.value))!;
                    setDraft({ ...draft, projectId: proj.id, projectName: proj.name });
                  }}
                >
                  {mockProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </F>
              <F label="Tracker">
                <select
                  className="input"
                  value={draft.tracker}
                  onChange={(e) => setDraft({ ...draft, tracker: e.target.value as Tracker })}
                >
                  {mockTrackers.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </F>
              <F label="Status">
                <select
                  className="input"
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as IssueStatus })}
                >
                  {mockIssueStatuses.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </F>
              <F label="Priority">
                <select
                  className="input"
                  value={draft.priority}
                  onChange={(e) =>
                    setDraft({ ...draft, priority: e.target.value as IssuePriority })
                  }
                >
                  {mockPriorities.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </F>
              <F label="Assignee">
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
              </F>
              <F label="Description" full>
                <textarea
                  className="input"
                  rows={4}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </F>
            </div>
          </Section>

          <Section title="Schedule">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <F label="Start date">
                <input
                  type="date"
                  className="input"
                  value={draft.startDate ?? ''}
                  onChange={(e) => setDraft({ ...draft, startDate: e.target.value || null })}
                />
              </F>
              <F label="Due date">
                <input
                  type="date"
                  className="input"
                  value={draft.dueDate ?? ''}
                  onChange={(e) => setDraft({ ...draft, dueDate: e.target.value || null })}
                />
              </F>
              <F label="% Done">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  className="input"
                  value={draft.doneRatio}
                  onChange={(e) => setDraft({ ...draft, doneRatio: Number(e.target.value) })}
                />
              </F>
              <F label="Estimated hours">
                <input
                  type="number"
                  step={0.25}
                  min={0}
                  className="input"
                  value={draft.estimatedHours ?? 0}
                  onChange={(e) =>
                    setDraft({ ...draft, estimatedHours: Number(e.target.value) || 0 })
                  }
                />
              </F>
              <F label="Spent hours">
                <input className="input" value={draft.spentHours} readOnly />
              </F>
              <F label="Next action">
                <input
                  type="text"
                  className="input"
                  value={draft.nextAction ?? ''}
                  onChange={(e) => setDraft({ ...draft, nextAction: e.target.value || null })}
                />
              </F>
            </div>
          </Section>

          <Section title="Relations">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="Parent task">
                <input
                  className="input"
                  value={draft.parentIssueId ?? ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      parentIssueId: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </F>
              <F label="Related tasks">
                <input
                  className="input"
                  placeholder="#1024, #1027"
                  value={draft.relations.map((r) => `#${r.issueId}`).join(', ')}
                  readOnly
                />
              </F>
            </div>
          </Section>

          <Section title="Custom fields">
            <CustomFields fields={draft.customFields} />
          </Section>

          <Section title="Attachments">
            <div className="border border-dashed border-gray-300 rounded p-4 text-xs text-ink-muted">
              Drag a file here to attach (placeholder).
            </div>
          </Section>

          <Section title="Comments / Journal">
            <div className="space-y-2">
              <div className="text-xs text-ink-muted">
                Existing journal entries aren't surfaced here yet. New comments
                post to Redmine as journal notes on this issue.
              </div>
              <textarea
                className="input"
                rows={2}
                placeholder="Add a comment…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={readOnly}
                data-testid="ticket-drawer-comment-input"
              />
              <button
                className="btn-secondary text-xs"
                onClick={postComment}
                disabled={saving || readOnly || !comment.trim()}
                title={readOnly ? 'Read-only mode — writes disabled' : undefined}
                data-testid="ticket-drawer-comment-post"
              >
                <MessageSquare size={12} /> Post comment
              </button>
            </div>
          </Section>
        </div>

        <div className="px-5 py-3 border-t flex items-center justify-between bg-canvas">
          <div className="flex items-center gap-2 text-xs">
            <button className="btn-ghost" onClick={() => onQuickEdit?.(issue)}>
              <ExternalLink size={14} /> Quick edit
            </button>
            {subtaskOpen ? (
              <span
                className="inline-flex items-center gap-1"
                data-testid="ticket-drawer-subtask-form"
              >
                <input
                  className="input text-xs py-1 px-2 w-44"
                  placeholder="Subtask subject"
                  value={subtaskSubject}
                  onChange={(e) => setSubtaskSubject(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void addSubtask();
                    if (e.key === 'Escape') {
                      setSubtaskOpen(false);
                      setSubtaskSubject('');
                    }
                  }}
                  data-testid="ticket-drawer-subtask-input"
                />
                <button
                  className="btn-brand text-xs px-2 py-1"
                  onClick={addSubtask}
                  disabled={saving || readOnly || !subtaskSubject.trim()}
                  data-testid="ticket-drawer-subtask-confirm"
                >
                  Add
                </button>
                <button
                  className="btn-ghost text-xs px-2 py-1"
                  onClick={() => {
                    setSubtaskOpen(false);
                    setSubtaskSubject('');
                  }}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                className="btn-ghost"
                onClick={() => setSubtaskOpen(true)}
                disabled={readOnly}
                title={readOnly ? 'Read-only mode — writes disabled' : undefined}
                data-testid="ticket-drawer-subtask-open"
              >
                <Plus size={14} /> Add subtask
              </button>
            )}
            <button className="btn-ghost">
              <Timer size={14} /> Log time
            </button>
            <button className="btn-ghost">
              <Copy size={14} /> Duplicate
            </button>
            <button
              className="btn-ghost"
              onClick={() => setDraft({ ...draft, status: 'Closed', doneRatio: 100 })}
            >
              <CheckCircle2 size={14} /> Mark complete
            </button>
            {onDeleted && (
              <button
                className="btn-ghost text-red-700 hover:bg-red-50"
                onClick={handleDelete}
                disabled={saving || readOnly}
                title={readOnly ? 'Read-only mode — writes disabled' : undefined}
                data-testid="ticket-drawer-delete"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="btn-brand"
              onClick={save}
              disabled={saving || readOnly}
              title={readOnly ? 'Read-only mode — writes disabled' : undefined}
            >
              <Save size={14} /> Save changes
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}

function F({
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

const MOCK_MODE =
  (import.meta.env.VITE_MOCK_MODE ?? 'true').toString().toLowerCase() !== 'false';

function CustomFields({ fields }: { fields: CustomField[] }) {
  if (fields.length > 0) {
    return (
      <dl
        className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm"
        data-testid="custom-fields-list"
      >
        {fields.map((f) => (
          <div key={f.id} className="flex flex-col">
            <dt className="text-xs text-ink-muted">{f.name}</dt>
            <dd className="text-ink">{formatCustomFieldValue(f.value)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <div
      className="text-xs text-ink-muted"
      data-testid="custom-fields-empty"
    >
      {MOCK_MODE
        ? 'No custom fields configured for this tracker.'
        : 'No custom fields set on this issue. The catalog is sampled from recent issues — /custom_fields.json is admin-only and may not surface every field defined in Redmine.'}
    </div>
  );
}

function formatCustomFieldValue(v: CustomField['value']): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}
