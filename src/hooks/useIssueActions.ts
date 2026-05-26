import { useState } from 'react';
import type { Issue } from '../types/redmine';
import {
  addIssueComment,
  addSubtask,
  createIssue,
  deleteIssue,
  updateIssue,
  updateIssueHierarchy,
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
    if (e.code === 'NOT_FOUND') return 'Issue not found.';
    if (e.code === 'UPSTREAM_ERROR' || e.code === 'BAD_REQUEST') return e.message;
    if (typeof e.message === 'string') return e.message;
  }
  return 'Operation failed.';
}

export interface UseIssueActionsResult {
  /** True whenever any action is in-flight. */
  saving: boolean;
  /** Patch an existing issue. */
  save: (id: number, patch: Partial<Issue>) => Promise<Issue>;
  /** Create a new issue. Requires `projectId` and `subject` in input. */
  create: (input: Partial<Issue>) => Promise<Issue>;
  /** Delete an issue. */
  remove: (id: number) => Promise<{ id: number }>;
  /** Add a comment (journal note) without changing other fields. */
  comment: (id: number, body: string) => Promise<void>;
  /** Move an issue under a new parent (or null to detach). */
  reparent: (id: number, parentId: number | null) => Promise<Issue>;
  /** Create a child issue under the given parent. */
  addSubtaskFor: (parentId: number, input: Partial<Issue>) => Promise<Issue>;
}

/**
 * Centralized issue mutation hook for the dashboard UI. Every method
 * surfaces a success / error toast and rethrows so the caller can keep
 * the surrounding dialog or row open for retry.
 *
 * This is the "fan-out" of the save pattern landed in plan §9 Step 10.
 * Time-entry mutations will get a sibling `useTimeEntryActions` hook
 * with the same shape.
 */
export function useIssueActions(): UseIssueActionsResult {
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
        () => updateIssue(id, patch),
        () => `Saved #${id}.`,
        (err) => `Couldn't save #${id}: ${describeError(err)}`,
      ),
    create: (input) =>
      run(
        () => createIssue(input),
        (issue) => `Created #${issue.id}.`,
        (err) => `Couldn't create issue: ${describeError(err)}`,
      ),
    remove: (id) =>
      run(
        () => deleteIssue(id),
        () => `Deleted #${id}.`,
        (err) => `Couldn't delete #${id}: ${describeError(err)}`,
      ),
    comment: async (id, body) => {
      await run(
        () => addIssueComment(id, body),
        () => `Comment added to #${id}.`,
        (err) => `Couldn't comment on #${id}: ${describeError(err)}`,
      );
    },
    reparent: (id, parentId) =>
      run(
        () => updateIssueHierarchy(id, parentId),
        () =>
          parentId === null
            ? `#${id} detached from parent.`
            : `#${id} moved under #${parentId}.`,
        (err) => `Couldn't reparent #${id}: ${describeError(err)}`,
      ),
    addSubtaskFor: (parentId, input) =>
      run(
        () => addSubtask(parentId, input),
        (child) => `Created subtask #${child.id} under #${parentId}.`,
        (err) => `Couldn't add subtask under #${parentId}: ${describeError(err)}`,
      ),
  };
}
