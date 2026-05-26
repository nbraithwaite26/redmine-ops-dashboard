import { useState } from 'react';
import type { TimeEntry } from '../types/redmine';
import {
  createTimeEntry,
  deleteTimeEntry,
  updateTimeEntry,
} from '../services/redmineApi';
import { pushToast } from '../lib/toast';

interface BackendErrorLike {
  status?: number;
  code?: string;
  message: string;
}

function describeError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as BackendErrorLike;
    if (e.code === 'READ_ONLY') return 'Backend is in read-only mode.';
    if (e.code === 'RATE_LIMITED') return 'Too many requests. Try again in a moment.';
    if (e.code === 'NOT_FOUND') return 'Time entry not found.';
    if (e.code === 'UPSTREAM_ERROR' || e.code === 'BAD_REQUEST') return e.message;
    if (typeof e.message === 'string') return e.message;
  }
  return 'Operation failed.';
}

export interface UseTimeEntryActionsResult {
  /** True while any mutation is in-flight. */
  saving: boolean;
  /** Patch an existing time entry. */
  save: (id: number, patch: Partial<TimeEntry>) => Promise<TimeEntry>;
  /** Create a new time entry. Requires hours + spentOn + (projectId OR issueId). */
  create: (input: Partial<TimeEntry>) => Promise<TimeEntry>;
  /** Delete a time entry. */
  remove: (id: number) => Promise<{ id: number }>;
}

/**
 * Time-entry mutation hook. Mirrors `useIssueActions`: each method
 * surfaces a kind-aware toast and rethrows so the caller can keep the
 * surrounding modal/row open for retry.
 */
export function useTimeEntryActions(): UseTimeEntryActionsResult {
  const [saving, setSaving] = useState(false);

  const run = async <T,>(
    op: () => Promise<T>,
    onSuccess: (result: T) => string,
    onError: (err: unknown) => string,
  ): Promise<T> => {
    setSaving(true);
    try {
      const result = await op();
      pushToast({ kind: 'success', message: onSuccess(result) });
      return result;
    } catch (err) {
      pushToast({ kind: 'error', message: onError(err) });
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return {
    saving,
    save: (id, patch) =>
      run(
        () => updateTimeEntry(id, patch),
        () => `Saved time entry #${id}.`,
        (err) => `Couldn't save time entry #${id}: ${describeError(err)}`,
      ),
    create: (input) =>
      run(
        () => createTimeEntry(input),
        (entry) => `Logged ${entry.hours}h.`,
        (err) => `Couldn't log time: ${describeError(err)}`,
      ),
    remove: (id) =>
      run(
        () => deleteTimeEntry(id),
        () => `Deleted time entry #${id}.`,
        (err) => `Couldn't delete time entry #${id}: ${describeError(err)}`,
      ),
  };
}
