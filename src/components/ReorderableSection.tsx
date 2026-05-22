import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  /** Stable id used as the key in useSectionOrder. */
  id: string;
  /** Section header title. */
  title: string;
  /** Optional sub-text under the title. */
  subtitle?: string;
  /** Disable the move-up button (no-op at the top of the list). */
  canMoveUp: boolean;
  /** Disable the move-down button (no-op at the bottom of the list). */
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  /** Optional right-aligned actions slot in the header. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Section wrapper with up/down reorder controls. Pure presentation —
 * ordering state lives in `useSectionOrder`.
 */
export default function ReorderableSection({
  id,
  title,
  subtitle,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  actions,
  children,
}: Props) {
  return (
    <section
      data-testid={`section-${id}`}
      data-section-id={id}
      className="card overflow-hidden"
    >
      <header className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 bg-canvas/50">
        <div className="flex flex-col gap-0.5 mr-2" aria-label={`${title} reorder controls`}>
          <button
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label={`Move ${title} up`}
            className="p-0.5 rounded hover:bg-gray-100 text-ink-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label={`Move ${title} down`}
            className="p-0.5 rounded hover:bg-gray-100 text-ink-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronDown size={14} />
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-ink truncate">{title}</h2>
          {subtitle && (
            <p className="text-xs text-ink-muted truncate">{subtitle}</p>
          )}
        </div>
        {actions}
      </header>
      <div>{children}</div>
    </section>
  );
}
