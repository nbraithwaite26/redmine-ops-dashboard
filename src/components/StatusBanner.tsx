import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import clsx from 'clsx';

export type BannerSeverity = 'info' | 'success' | 'warning' | 'error';

interface Props {
  severity: BannerSeverity;
  message: string;
  /** When set, an X button appears that calls this handler. */
  onDismiss?: () => void;
}

const STYLES: Record<BannerSeverity, string> = {
  info: 'bg-blue-50 border-blue-200 text-blue-900',
  success: 'bg-green-50 border-green-200 text-green-900',
  warning: 'bg-orange-50 border-orange-200 text-orange-900',
  error: 'bg-red-50 border-red-200 text-red-900',
};

const ICON = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
} as const;

/**
 * Thin notice bar designed to sit directly under the top bar across the
 * full app width. Pure presentation — state machine lives in
 * `useSyncBanner`.
 */
export default function StatusBanner({ severity, message, onDismiss }: Props) {
  const Icon = ICON[severity];
  return (
    <div
      role="status"
      data-severity={severity}
      data-testid="status-banner"
      className={clsx(
        'flex items-center gap-2 px-4 py-2 border-b text-sm',
        STYLES[severity],
      )}
    >
      <Icon size={16} aria-hidden="true" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss banner"
          className="p-1 -mr-1 rounded hover:bg-black/5"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
