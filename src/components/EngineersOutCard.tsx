import { motion } from 'framer-motion';
import { CalendarOff } from 'lucide-react';

interface Props {
  /** Distinct engineers out in the selected week. */
  outCount: number;
  /** Total engineers on the team (sub-caption). */
  total: number;
  onSelect: () => void;
}

/**
 * Replaces the plain "Engineers" metric card on the Team dashboard. Shows how
 * many engineers are out in the selected week and, when tapped, morphs into
 * the full-screen time-off calendar (TimeOffDetail) via a shared `layoutId`.
 */
export default function EngineersOutCard({ outCount, total, onSelect }: Props) {
  return (
    <motion.button
      type="button"
      layoutId="engineers-out-card"
      onClick={onSelect}
      whileTap={{ scale: 0.97 }}
      style={{ borderRadius: 16 }}
      className="card flex flex-col p-4 text-left transition hover:border-gray-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-300"
      data-testid="engineers-out-card"
      aria-label={`${outCount} engineers out this week, ${total} on the team. Tap for the time-off calendar.`}
    >
      <div className="flex items-start justify-between">
        <div className="text-sm font-medium text-ink-soft">Engineers out</div>
        <CalendarOff size={16} className="text-ink-muted" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-1 py-3">
        <div
          className="text-4xl font-semibold tabular-nums text-ink"
          data-testid="engineers-out-count"
        >
          {outCount}
        </div>
        <div className="text-xs text-ink-muted">out this week</div>
      </div>
      <div className="flex items-center justify-center gap-2 text-xs text-ink-muted">
        <span className="pill-gray">{total} on the team</span>
      </div>
    </motion.button>
  );
}
