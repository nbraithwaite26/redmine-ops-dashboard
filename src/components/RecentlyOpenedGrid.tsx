import { Bookmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface RecentItem {
  /** Stable id used as the React key and avatar fallback. */
  id: string;
  title: string;
  /** Short type label shown above the title (e.g. "Workspace"). */
  type: string;
  description: string;
  /** Destination route. */
  to: string;
}

interface Props {
  items: RecentItem[];
  /** Number of columns at xl breakpoint. */
  columns?: 2 | 3 | 4;
}

/**
 * Grid of letter-avatar cards. Pure presentation — caller supplies the
 * items and routing.
 */
export default function RecentlyOpenedGrid({ items, columns = 4 }: Props) {
  const navigate = useNavigate();
  const colClass =
    columns === 4
      ? 'md:grid-cols-2 xl:grid-cols-4'
      : columns === 3
      ? 'md:grid-cols-2 xl:grid-cols-3'
      : 'md:grid-cols-2';
  return (
    <div data-testid="recently-opened-grid" className={`grid gap-3 ${colClass}`}>
      {items.map((item) => (
        <article
          key={item.id}
          className="card p-4 cursor-pointer hover:shadow-md transition"
          onClick={() => navigate(item.to)}
          role="button"
          aria-label={item.title}
          tabIndex={0}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-50 font-bold text-blue-700 text-sm">
              {item.title.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={(e) => e.stopPropagation()}
              aria-label={`Bookmark ${item.title}`}
              className="text-ink-muted hover:text-ink"
            >
              <Bookmark size={14} />
            </button>
          </div>
          <h3 className="font-semibold text-ink">{item.title}</h3>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            {item.type}
          </p>
          <p className="mt-2 text-sm text-ink-soft line-clamp-2">{item.description}</p>
        </article>
      ))}
    </div>
  );
}
