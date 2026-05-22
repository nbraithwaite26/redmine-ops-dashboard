import { useState } from 'react';
import { Save, X } from 'lucide-react';
import {
  mockIssues,
  mockProjects,
  mockTimeActivities,
  mockUsers,
} from '../data/mockData';
import { createTimeEntry } from '../services/redmineApi';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

/**
 * "Add time entry" dialog launched from the TimeTracking page. Extracted
 * into its own component in Phase C so the page file focuses on data
 * loading + table rendering. The inline `<style>` block is removed in
 * Phase D in favor of a shared `.modal-input` class on `index.css`.
 */
export default function AddTimeModal({ onClose, onCreated }: Props) {
  const [userId, setUserId] = useState(mockUsers[0].id);
  const [projectId, setProjectId] = useState(mockProjects[0].id);
  const [issueId, setIssueId] = useState<number | null>(null);
  const [activity, setActivity] = useState(mockTimeActivities[0]);
  const [hours, setHours] = useState('');
  const [spentOn, setSpentOn] = useState(new Date().toISOString().slice(0, 10));
  const [comments, setComments] = useState('');

  const projectIssues = mockIssues.filter((i) => i.projectId === projectId);

  const save = async () => {
    const user = mockUsers.find((u) => u.id === userId)!;
    await createTimeEntry({
      user,
      projectId,
      issueId,
      activity,
      hours: Number(hours) || 0,
      spentOn,
      comments,
    });
    onCreated();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-time-title"
    >
      <div
        className="bg-white w-[520px] max-w-[95vw] rounded-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div id="add-time-title" className="font-semibold">
            Add time entry
          </div>
          <button onClick={onClose} aria-label="Close add time">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4 text-sm">
          <label>
            <div className="text-xs text-ink-muted mb-1">Date</div>
            <input
              type="date"
              className="modal-input"
              value={spentOn}
              onChange={(e) => setSpentOn(e.target.value)}
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
            />
          </label>
          <label>
            <div className="text-xs text-ink-muted mb-1">User</div>
            <select
              className="modal-input"
              value={userId}
              onChange={(e) => setUserId(Number(e.target.value))}
            >
              {mockUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
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
            >
              {mockTimeActivities.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="text-xs text-ink-muted mb-1">Project</div>
            <select
              className="modal-input"
              value={projectId}
              onChange={(e) => {
                setProjectId(Number(e.target.value));
                setIssueId(null);
              }}
            >
              {mockProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="text-xs text-ink-muted mb-1">Issue</div>
            <select
              className="modal-input"
              value={issueId ?? ''}
              onChange={(e) => setIssueId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— None —</option>
              {projectIssues.map((i) => (
                <option key={i.id} value={i.id}>
                  #{i.id} {i.subject}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2">
            <div className="text-xs text-ink-muted mb-1">Comment</div>
            <input
              className="modal-input"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </label>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-brand" onClick={save}>
            <Save size={14} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}
