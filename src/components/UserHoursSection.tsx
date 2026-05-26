import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import type { Issue } from '../types/redmine';
import {
  loadHoursData,
  type HoursData,
  type WeekRange,
} from '../lib/hoursAggregate';

interface Props {
  /** Section heading, e.g. "This week" / "Last week". */
  title: string;
  range: WeekRange;
  readOnly: boolean;
  onLogTime: (issue: Issue) => void;
  /** Rendered for each user summary; lets the parent control the card. */
  renderCard: (
    summary: HoursData['users'][number],
    readOnly: boolean,
    onLogTime: (issue: Issue) => void,
  ) => React.ReactNode;
}

/**
 * Section wrapper for one Hours block (this-week or last-week). Owns
 * the data fetch + loading / error states; delegates card rendering
 * to the parent via renderCard so the same section is reusable.
 */
export default function UserHoursSection({
  title,
  range,
  readOnly,
  onLogTime,
  renderCard,
}: Props) {
  const [data, setData] = useState<HoursData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadHoursData(range)
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // We intentionally depend on the primitive range fields rather than the
    // `range` object identity — callers usually compute the range once and
    // pass it down; identity equality would re-fetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  // Only users with tasks or hours show up — empty users would just
  // clutter the comparison.
  const visible = (data?.users ?? []).filter(
    (s) => s.taskCount > 0 || s.totalHours > 0,
  );

  return (
    <section data-testid={`hours-section-${range.offset}`} className="space-y-3">
      <header>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-xs text-ink-muted">{range.label}</p>
      </header>

      {loading && !data ? (
        <p className="text-sm text-ink-muted" data-testid={`hours-loading-${range.offset}`}>
          Loading hours…
        </p>
      ) : error ? (
        <div className="card p-3 text-sm flex items-start gap-2" data-testid={`hours-error-${range.offset}`}>
          <AlertCircle size={14} className="mt-0.5 text-red-700" />
          <div>
            <p className="font-medium">Couldn't load hours</p>
            <p className="text-xs text-ink-muted">{error.message}</p>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="card p-4 text-sm text-ink-muted" data-testid={`hours-empty-${range.offset}`}>
          No hours logged this {range.offset === 0 ? 'week' : 'period'}.
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((summary) => (
            <div key={summary.user.id}>
              {renderCard(summary, readOnly, onLogTime)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
