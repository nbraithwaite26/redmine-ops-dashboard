import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useSaveIssue } from '../hooks/useSaveIssue';
import { clearToasts, getToasts } from '../lib/toast';
import { getMyIssues } from '../services/redmineApi';

describe('useSaveIssue (mock-mode integration)', () => {
  beforeEach(() => clearToasts());
  afterEach(() => clearToasts());

  it('saves a patch and surfaces a success toast', async () => {
    const issues = await getMyIssues();
    expect(issues.length).toBeGreaterThan(0);
    const target = issues[0]!;

    const { result } = renderHook(() => useSaveIssue());

    let updated: Awaited<ReturnType<typeof result.current.save>> | undefined;
    await act(async () => {
      updated = await result.current.save(target.id, {
        ...target,
        doneRatio: Math.min(100, target.doneRatio + 5),
      });
    });

    expect(updated).toBeDefined();
    expect(updated!.id).toBe(target.id);
    expect(updated!.doneRatio).toBe(Math.min(100, target.doneRatio + 5));

    await waitFor(() => {
      const toasts = getToasts();
      expect(toasts).toHaveLength(1);
      expect(toasts[0]!.kind).toBe('success');
      expect(toasts[0]!.message).toContain(`#${target.id}`);
    });
  });

  it('sets saving=true during the in-flight save', async () => {
    const issues = await getMyIssues();
    const target = issues[0]!;

    const { result } = renderHook(() => useSaveIssue());

    expect(result.current.saving).toBe(false);
    const promise = act(async () => {
      await result.current.save(target.id, { subject: target.subject });
    });
    await promise;
    expect(result.current.saving).toBe(false);
  });
});
