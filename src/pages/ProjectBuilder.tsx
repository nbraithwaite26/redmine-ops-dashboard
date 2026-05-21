import { useState } from 'react';
import { GripVertical, Plus, Save, Trash2, Upload } from 'lucide-react';
import { mockPriorities, mockUsers } from '../data/mockData';
import { createProject } from '../services/redmineApi';

interface BuilderTask {
  id: string;
  subject: string;
  assigneeId: number | null;
  estimatedHours: number;
  dueDate: string;
  priority: string;
  isMilestone: boolean;
  parentId: string | null;
}

let counter = 1;
const nextId = () => `t-${counter++}`;

export default function ProjectBuilder() {
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [description, setDescription] = useState('');
  const [tasks, setTasks] = useState<BuilderTask[]>([
    { id: nextId(), subject: 'Kickoff meeting', assigneeId: null, estimatedHours: 1, dueDate: '', priority: 'Normal', isMilestone: true, parentId: null },
  ]);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const addTask = (parentId: string | null = null) =>
    setTasks((prev) => [
      ...prev,
      {
        id: nextId(),
        subject: '',
        assigneeId: null,
        estimatedHours: 4,
        dueDate: '',
        priority: 'Normal',
        isMilestone: false,
        parentId,
      },
    ]);

  const update = (id: string, patch: Partial<BuilderTask>) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const remove = (id: string) =>
    setTasks((prev) => prev.filter((t) => t.id !== id && t.parentId !== id));

  const save = async () => {
    setSaving(true);
    try {
      const project = await createProject({ name, identifier, description });
      setSavedMessage(`Saved project "${project.name}" with ${tasks.length} task(s) (mock).`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Project Builder</h1>
        <div className="flex items-center gap-2">
          <button className="btn-secondary"><Upload size={14} /> Push to Redmine</button>
          <button className="btn-brand" onClick={save} disabled={saving || !name}>
            <Save size={14} /> Save structure
          </button>
        </div>
      </div>
      {savedMessage && (
        <div className="card p-3 text-sm text-green-800 bg-green-50 border-green-100">
          {savedMessage}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <section className="card p-4 space-y-2 col-span-2">
          <h2 className="font-semibold">Project details</h2>
          <label className="block text-sm">
            <span className="text-xs text-ink-muted">Project name</span>
            <input
              className="builder-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aircraft Retrofit Planning"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-ink-muted">Identifier</span>
            <input
              className="builder-input"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. aircraft-retrofit"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-ink-muted">Description</span>
            <textarea
              className="builder-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </section>
        <section className="card p-4 space-y-2">
          <h2 className="font-semibold">Team assignment</h2>
          <div className="text-xs text-ink-muted">
            Select team members. Assignment to individual tasks happens in the hierarchy.
          </div>
          <ul className="space-y-1 text-sm">
            {mockUsers.map((u) => (
              <li key={u.id} className="flex items-center gap-2">
                <input type="checkbox" defaultChecked /> {u.name}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Task hierarchy builder</h2>
          <div className="flex items-center gap-2">
            <button className="btn-ghost text-sm" onClick={() => addTask(null)}>
              <Plus size={14} /> Add task
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {tasks.map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-[24px_1fr_140px_120px_120px_120px_80px_32px] items-center gap-2 px-2 py-1.5 border border-gray-100 rounded hover:bg-canvas/50"
              style={t.parentId ? { marginLeft: 28 } : undefined}
            >
              <button className="text-ink-muted cursor-grab" aria-label="Drag">
                <GripVertical size={14} />
              </button>
              <input
                className="builder-input"
                value={t.subject}
                placeholder="Task subject"
                onChange={(e) => update(t.id, { subject: e.target.value })}
              />
              <select
                className="builder-input"
                value={t.assigneeId ?? ''}
                onChange={(e) =>
                  update(t.id, { assigneeId: e.target.value ? Number(e.target.value) : null })
                }
              >
                <option value="">Unassigned</option>
                {mockUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <input
                type="date"
                className="builder-input"
                value={t.dueDate}
                onChange={(e) => update(t.id, { dueDate: e.target.value })}
              />
              <input
                type="number"
                step={0.5}
                className="builder-input"
                value={t.estimatedHours}
                onChange={(e) => update(t.id, { estimatedHours: Number(e.target.value) || 0 })}
              />
              <select
                className="builder-input"
                value={t.priority}
                onChange={(e) => update(t.id, { priority: e.target.value })}
              >
                {mockPriorities.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <label className="text-xs text-ink-muted flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={t.isMilestone}
                  onChange={(e) => update(t.id, { isMilestone: e.target.checked })}
                />
                KPI
              </label>
              <button
                className="p-1 rounded hover:bg-gray-100 text-ink-muted"
                onClick={() => remove(t.id)}
                aria-label="Remove task"
              >
                <Trash2 size={14} />
              </button>
              <div className="col-span-8 pl-8">
                <button className="text-xs link" onClick={() => addTask(t.id)}>
                  + Add subtask under {t.subject || 'this task'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <style>{`
        .builder-input {
          width: 100%;
          padding: 0.35rem 0.55rem;
          border: 1px solid #E5E7EB;
          border-radius: 0.375rem;
          font-size: 0.85rem;
        }
        .builder-input:focus {
          outline: none;
          border-color: #FEDF00;
          box-shadow: 0 0 0 2px rgba(254, 223, 0, 0.3);
        }
      `}</style>
    </div>
  );
}
