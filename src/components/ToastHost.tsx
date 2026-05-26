import clsx from 'clsx';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useToasts } from '../hooks/useToasts';
import { dismissToast } from '../lib/toast';

const KIND_STYLES: Record<string, { ring: string; icon: React.ReactNode }> = {
  success: {
    ring: 'border-green-200',
    icon: <CheckCircle2 size={16} className="text-green-700" />,
  },
  error: {
    ring: 'border-red-200',
    icon: <AlertCircle size={16} className="text-red-700" />,
  },
  info: {
    ring: 'border-gray-200',
    icon: <Info size={16} className="text-ink-muted" />,
  },
};

export default function ToastHost() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]"
      role="status"
      aria-live="polite"
      data-testid="toast-host"
    >
      {toasts.map((t) => {
        const styles = KIND_STYLES[t.kind] ?? KIND_STYLES.info!;
        return (
          <div
            key={t.id}
            data-testid={`toast-${t.kind}`}
            className={clsx(
              'card px-3 py-2 text-sm flex items-start gap-2 shadow-md border',
              styles.ring,
            )}
          >
            <span className="mt-0.5 shrink-0">{styles.icon}</span>
            <p className="flex-1">{t.message}</p>
            <button
              onClick={() => dismissToast(t.id)}
              className="text-ink-muted hover:text-ink shrink-0"
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
