import { useSyncExternalStore } from 'react';
import { getToasts, subscribeToToasts, type Toast } from '../lib/toast';

/**
 * Subscribes to the toast store. Re-renders the caller whenever a toast is
 * pushed, dismissed, or the list is cleared.
 */
export function useToasts(): ReadonlyArray<Toast> {
  return useSyncExternalStore(subscribeToToasts, getToasts, getToasts);
}
