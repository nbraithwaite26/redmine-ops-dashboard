import { useState } from 'react';
import type { Issue } from '../types/redmine';
import { updateIssue } from '../services/redmineApi';
import { pushToast } from '../lib/toast';

export interface UseSaveIssueResult {
  saving: boolean;
  /**
   * Save an issue patch through the redmineApi facade.
   *
   * Success path: resolves to the server-returned `Issue`, fires a success
   * toast, and the caller typically closes the dialog and refreshes the
   * parent's list.
   *
   * Error path: surfaces an error toast (using the backend's error code
   * when present), keeps the dialog open by letting the rejection bubble
   * to the caller's catch. The dialog's local draft state is unchanged
   * so the user can edit and retry.
   */
  save: (id: number, patch: Partial<Issue>) => Promise<Issue>;
}

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
    if (e.code === 'NOT_FOUND') return 'Issue not found.';
    if (e.code === 'UPSTREAM_ERROR' || e.code === 'BAD_REQUEST') return e.message;
    if (typeof e.message === 'string') return e.message;
  }
  return 'Save failed.';
}

/**
 * Shared save-flow hook for issue mutations. Centralizes the toast + error
 * handling so QuickEditPopup, TicketDrawer, and (eventually) inline edits
 * don't duplicate the logic.
 *
 * This is the "land a pattern" hook for plan §7.7. Fan-out work will add:
 *   - saveTimeEntry, addIssueComment, etc. wrappers in the same shape
 *   - true list-level optimistic updates (the caller's parent must
 *     support `applyLocally(prev)` reverts; not all parents do today)
 */
export function useSaveIssue(): UseSaveIssueResult {
  const [saving, setSaving] = useState(false);

  const save = async (id: number, patch: Partial<Issue>): Promise<Issue> => {
    setSaving(true);
    try {
      const updated = await updateIssue(id, patch);
      pushToast({ kind: 'success', message: `Saved #${id}.` });
      return updated;
    } catch (err) {
      pushToast({ kind: 'error', message: `Couldn't save #${id}: ${describeError(err)}` });
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return { saving, save };
}
