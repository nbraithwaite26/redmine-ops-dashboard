import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Check, Users } from 'lucide-react';
import type { User } from '../types/redmine';

interface Props {
  users: User[];
  selected: number[];
  onChange: (ids: number[]) => void;
}

/**
 * Compact popover multi-select controlling which engineers appear as cards on
 * the "Your Team's Work" tab. Closes on outside click or Escape.
 */
export default function TeamMemberSelector({ users, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name));
  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        data-testid="team-selector-toggle"
      >
        <Users size={14} /> Engineers ({selected.length})
      </button>

      {open && (
        <div
          className="card absolute right-0 z-30 mt-2 max-h-80 w-64 overflow-auto p-2 shadow-lg"
          role="listbox"
          aria-multiselectable
          data-testid="team-selector-menu"
        >
          <div className="flex items-center justify-between px-2 py-1 text-xs">
            <button type="button" className="link" onClick={() => onChange(sorted.map((u) => u.id))}>
              Select all
            </button>
            <button type="button" className="link" onClick={() => onChange([])}>
              Clear
            </button>
          </div>
          {sorted.map((u) => {
            const on = selected.includes(u.id);
            return (
              <button
                key={u.id}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => toggle(u.id)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-canvas/60"
                data-testid={`team-selector-option-${u.id}`}
              >
                <span
                  className={clsx(
                    'grid h-4 w-4 shrink-0 place-items-center rounded border',
                    on ? 'border-brand-500 bg-brand-500 text-white' : 'border-gray-300',
                  )}
                >
                  {on && <Check size={12} />}
                </span>
                <span className="truncate">{u.name}</span>
              </button>
            );
          })}
          {sorted.length === 0 && (
            <div className="px-2 py-3 text-center text-xs text-ink-muted">No engineers found.</div>
          )}
        </div>
      )}
    </div>
  );
}
