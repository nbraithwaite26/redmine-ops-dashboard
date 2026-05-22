import { clampProgress } from '../lib/visual';

interface Props {
  /** 0–100. Out-of-range values are clamped. */
  value: number;
  /** Width of the bar track in pixels. */
  width?: number;
  /** Height of the bar in pixels. */
  height?: number;
  /** Fill color when value > 0. */
  fillColor?: string;
  /** Track color underneath the fill. */
  trackColor?: string;
  /** Show the numeric percentage to the right of the bar. */
  showLabel?: boolean;
  /** Optional aria-label for assistive tech. */
  ariaLabel?: string;
}

/**
 * Tiny horizontal progress bar used in dense table cells. Pure presentation.
 */
export default function ProgressBar({
  value,
  width = 64,
  height = 6,
  fillColor = '#10B981',
  trackColor = '#E5E7EB',
  showLabel = true,
  ariaLabel,
}: Props) {
  const pct = clampProgress(value);
  return (
    <div className="inline-flex items-center gap-2 text-xs" data-testid="progress-bar">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={ariaLabel}
        style={{
          width,
          height,
          borderRadius: height,
          background: trackColor,
          overflow: 'hidden',
        }}
      >
        <div
          data-testid="progress-bar-fill"
          style={{
            width: `${pct}%`,
            height: '100%',
            background: fillColor,
            transition: 'width 200ms ease',
          }}
        />
      </div>
      {showLabel && <span className="text-ink-soft tabular-nums">{pct}%</span>}
    </div>
  );
}
