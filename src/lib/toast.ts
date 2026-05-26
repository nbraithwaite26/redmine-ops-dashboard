/**
 * Minimal toast infrastructure. A module-level store + subscribe API so any
 * code path (hooks, services, plain functions) can `pushToast()` without
 * threading a context through every render tree.
 *
 * Consumed by:
 *   - useToasts()   subscribes via useSyncExternalStore (src/hooks/useToasts.ts)
 *   - <ToastHost /> renders the active list (src/components/ToastHost.tsx)
 */

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const DEFAULT_DISMISS_MS = 4000;

let nextId = 1;
let toasts: ReadonlyArray<Toast> = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function pushToast(input: Omit<Toast, 'id'>, opts: { dismissAfterMs?: number } = {}): number {
  const id = nextId++;
  toasts = [...toasts, { ...input, id }];
  emit();
  const ms = opts.dismissAfterMs ?? DEFAULT_DISMISS_MS;
  if (ms > 0 && typeof window !== 'undefined') {
    window.setTimeout(() => dismissToast(id), ms);
  }
  return id;
}

export function dismissToast(id: number): void {
  const next = toasts.filter((t) => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

export function clearToasts(): void {
  if (toasts.length === 0) return;
  toasts = [];
  emit();
}

export function getToasts(): ReadonlyArray<Toast> {
  return toasts;
}

export function subscribeToToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
