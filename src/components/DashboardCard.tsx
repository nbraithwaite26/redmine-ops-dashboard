import { MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DashboardMetric } from '../types/redmine';
import { donutGradient } from '../lib/visual';

type StatusColor = 'green' | 'orange' | 'red' | 'blue' | 'gray' | 'yellow';

const STATUS_CLASS: Record<StatusColor, string> = {
  green: 'pill-green',
  orange: 'pill-orange',
  red: 'pill-red',
  blue: 'pill-blue',
  gray: 'pill-gray',
  yellow: 'pill-yellow',
};

interface MetricProps {
  /** Render directly from a typed DashboardMetric. The card builds its own
   *  conic-gradient donut + footer. */
  metric: DashboardMetric;
  onClick?: () => void;
}

interface LegacyProps {
  title: string;
  status?: string;
  statusColor?: StatusColor;
  visual?: ReactNode;
  onClick?: () => void;
  children?: ReactNode;
}

type Props = MetricProps | LegacyProps;

function isMetricProps(props: Props): props is MetricProps {
  return 'metric' in props;
}

export default function DashboardCard(props: Props) {
  const navigate = useNavigate();

  if (isMetricProps(props)) {
    const { metric, onClick } = props;
    const handle =
      onClick ?? (metric.route ? () => navigate(metric.route!) : undefined);
    const valueLabel =
      metric.total !== undefined ? `${metric.value}/${metric.total}` : `${metric.value}`;
    return (
      <CardShell title={metric.title} onClick={handle}>
        <div className="flex-1 flex flex-col items-center justify-center py-3 gap-1">
          <ConicRing progress={metric.progress} color={metric.color} label={valueLabel} />
          {metric.caption && (
            <div className="text-xs text-ink-muted">{metric.caption}</div>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-ink-muted">
          {metric.statusLabel && (
            <span className={STATUS_CLASS[metric.statusColor ?? 'gray']}>{metric.statusLabel}</span>
          )}
        </div>
      </CardShell>
    );
  }

  const { title, status, statusColor = 'gray', visual, onClick, children } = props;
  return (
    <CardShell title={title} onClick={onClick}>
      <div className="flex-1 flex items-center justify-center py-3">{visual}</div>
      <div className="flex items-center justify-center gap-2 text-xs text-ink-muted">
        {status && <span className={STATUS_CLASS[statusColor]}>{status}</span>}
        {children}
      </div>
    </CardShell>
  );
}

function CardShell({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="card p-4 flex flex-col cursor-pointer hover:border-gray-200 hover:shadow-md transition"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? title : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="text-sm font-medium text-ink-soft">{title}</div>
        <button
          className="text-ink-muted hover:text-ink"
          aria-label="Card menu"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
      {children}
    </div>
  );
}

/** CSS conic-gradient ring with a white inner cutout and a centered label. */
function ConicRing({
  progress,
  color,
  label,
  size = 96,
  thickness = 10,
}: {
  progress: number;
  color: string;
  label: string;
  size?: number;
  thickness?: number;
}) {
  const inner = size - thickness * 2;
  return (
    <div
      role="img"
      aria-label={`${label} (${Math.round(progress)}%)`}
      data-testid="conic-ring"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: donutGradient(progress, color),
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div
        style={{
          width: inner,
          height: inner,
          borderRadius: '50%',
          background: 'white',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 600,
          fontSize: size * 0.22,
          color: '#111827',
        }}
      >
        {label}
      </div>
    </div>
  );
}
