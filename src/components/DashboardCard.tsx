import { MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  status?: string;
  statusColor?: 'green' | 'orange' | 'red' | 'blue' | 'gray' | 'yellow';
  visual?: ReactNode;
  onClick?: () => void;
  children?: ReactNode;
}

const STATUS_CLASS: Record<NonNullable<Props['statusColor']>, string> = {
  green: 'pill-green',
  orange: 'pill-orange',
  red: 'pill-red',
  blue: 'pill-blue',
  gray: 'pill-gray',
  yellow: 'pill-yellow',
};

export default function DashboardCard({ title, status, statusColor = 'gray', visual, onClick, children }: Props) {
  return (
    <div
      className="card p-4 flex flex-col cursor-pointer hover:border-gray-200 hover:shadow-md transition"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
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
      <div className="flex-1 flex items-center justify-center py-3">{visual}</div>
      <div className="flex items-center justify-center gap-2 text-xs text-ink-muted">
        {status && <span className={STATUS_CLASS[statusColor]}>{status}</span>}
        {children}
      </div>
    </div>
  );
}
