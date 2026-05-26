import { useMemo, useState } from 'react';
import AddTimeModal from '../components/AddTimeModal';
import UserHoursCard from '../components/UserHoursCard';
import UserHoursSection from '../components/UserHoursSection';
import { useReadOnly } from '../hooks/useReadOnly';
import { weekRange } from '../lib/hoursAggregate';
import type { Issue } from '../types/redmine';

/**
 * Hours / Time Tracking landing.
 *
 * Two stacked sections:
 *   - This week  (Monday → today)
 *   - Last week  (the full previous Monday → Sunday block)
 *
 * Each section renders user cards. Cards expand into projects; projects
 * expand into tasks; each task has a Log time button that opens the
 * AddTimeModal. Both sections use the same card layout so users can
 * compare current vs. prior week without a context switch.
 */
export default function Hours() {
  const { readOnly } = useReadOnly();

  // Compute once per mount — these are date ranges, not reactive state.
  const thisWeek = useMemo(() => weekRange(0), []);
  const lastWeek = useMemo(() => weekRange(-1), []);

  // The AddTimeModal lives at the page level so any task row (in either
  // section) can launch it. Pre-seeding lands in commit 3.
  const [logTimeTarget, setLogTimeTarget] = useState<Issue | null>(null);
  // Bumped after a successful log to force the visible sections to
  // re-fetch via the loader's range-keyed effect.
  const [, setReloadKey] = useState(0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Hours</h1>
        <p className="text-sm text-ink-muted">
          Per-engineer summary of this week and last week. Click a card to drill into
          projects and tasks.
        </p>
      </header>

      <UserHoursSection
        title="This week"
        range={thisWeek}
        readOnly={readOnly}
        onLogTime={setLogTimeTarget}
        renderCard={(summary, ro, onLog) => (
          <UserHoursCard summary={summary} readOnly={ro} onLogTime={onLog} />
        )}
      />

      <UserHoursSection
        title="Last week"
        range={lastWeek}
        readOnly={readOnly}
        onLogTime={setLogTimeTarget}
        renderCard={(summary, ro, onLog) => (
          <UserHoursCard summary={summary} readOnly={ro} onLogTime={onLog} />
        )}
      />

      {logTimeTarget && (
        <AddTimeModal
          onClose={() => setLogTimeTarget(null)}
          onCreated={() => {
            setLogTimeTarget(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
