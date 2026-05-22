import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageSquare,
  Plus,
  Save,
  Timer,
  X,
} from 'lucide-react';
import { useDialogA11y } from '../hooks/useDialogA11y';
import type { Issue, IssuePriority, IssueStatus, Tracker } from '../types/redmine';
import {
  mockIssueStatuses,
  mockPriorities,
  mockProjects,
  mockTrackers,
  mockUsers,
} from '../data/mockData';
import { updateIssue } from '../services/redmineApi';

interface Props {
  issue: Issue;
  onClose: () => void;
  onSaved: (issue: Issue) => void;
  onQuickEdit?: (issue: Issue) => void;
}

export default function TicketDrawer({ issue, onClose, onSaved, onQuickEdit }: Props) {
  const [draft, setDraft] = useState<Issue>(issue);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(issue), [issue]);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateIssue(issue.id, draft);
      onSaved(updated);
    } finally {
      setSaving(false);
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
            <div className="text-xs text-ink-muted">
              No custom fields configured for this tracker. Wire up real custom fields once
              the Redmine API is connected.
            </div>
          </Section>

          <Section title="Attachments">
            <div className="border border-dashed border-gray-300 rounded p-4 text-xs text-ink-muted">
              Drag a file here to attach (placeholder).
            </div>
          </Section>

          <Section title="Comments / Journal">
            <div className="space-y-2">
              <div className="text-xs text-ink-muted">
                Comments will appear here once the Redmine journal endpoint is wired up.
              </div>
              <textarea className="input" rows={2} placeholder="Add a comment…" />
              <button className="btn-secondary text-xs">
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
            <button className="btn-ghost">
              <Plus size={14} /> Add subtask
            </button>
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
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-brand" onClick={save} disabled={saving}>
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
