interface Props {
  value: number;
  total?: number;
  size?: number;
  thickness?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  caption?: string;
}

/**
 * Lightweight SVG donut chart. Renders a single value over an optional total,
 * mirroring the donut visuals from the reference dashboard.
 */
export default function DonutChart({
  value,
  total = 100,
  size = 96,
  thickness = 10,
  color = '#7C3AED',
  trackColor = '#E5E7EB',
  label,
  caption,
}: Props) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeTotal = total <= 0 ? 1 : total;
  const ratio = Math.max(0, Math.min(1, value / safeTotal));
  const dash = circumference * ratio;

  return (
    <div className="flex flex-col items-center justify-center" aria-label={label ?? 'donut chart'}>
      <svg width={size} height={size} role="img">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-ink"
          style={{ fontWeight: 600, fontSize: size * 0.28 }}
        >
          {label ?? value}
        </text>
      </svg>
      {caption && <div className="text-xs text-ink-muted mt-1">{caption}</div>}
    </div>
  );
}
