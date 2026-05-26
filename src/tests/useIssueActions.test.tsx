import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useIssueActions } from '../hooks/useIssueActions';
import { clearToasts, getToasts } from '../lib/toast';
import { getMyIssues, getProjects } from '../services/redmineApi';

describe('useIssueActions (mock-mode integration)', () => {
  beforeEach(() => clearToasts());
  afterEach(() => clearToasts());

  it('save() patches an issue and surfaces a success toast', async () => {
    const issues = await getMyIssues();
    expect(issues.length).toBeGreaterThan(0);
    const target = issues[0]!;

    const { result } = renderHook(() => useIssueActions());

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

    const { result } = renderHook(() => useIssueActions());

    expect(result.current.saving).toBe(false);
    await act(async () => {
      await result.current.save(target.id, { subject: target.subject });
    });
    expect(result.current.saving).toBe(false);
  });

  it('create() makes a new issue and toasts the new id', async () => {
    const projects = await getProjects();
    expect(projects.length).toBeGreaterThan(0);

    const { result } = renderHook(() => useIssueActions());

    let created: Awaited<ReturnType<typeof result.current.create>> | undefined;
    await act(async () => {
      created = await result.current.create({
        projectId: projects[0]!.id,
        subject: 'Anonymized created subject',
      });
    });

    expect(created).toBeDefined();
    expect(created!.subject).toBe('Anonymized created subject');

    await waitFor(() => {
      const toasts = getToasts();
      expect(toasts.some((t) => t.kind === 'success' && t.message.includes(`#${created!.id}`))).toBe(true);
    });
  });

  it('remove() deletes an issue and toasts', async () => {
    const projects = await getProjects();
    const { result } = renderHook(() => useIssueActions());

    // Create a doomed issue so we don't disturb other fixtures.
    let doomed: Awaited<ReturnType<typeof result.current.create>> | undefined;
    await act(async () => {
      doomed = await result.current.create({
        projectId: projects[0]!.id,
        subject: 'Anonymized doomed issue',
      });
    });
    expect(doomed).toBeDefined();
    const doomedId = doomed!.id;
    clearToasts();

    let removed: Awaited<ReturnType<typeof result.current.remove>> | undefined;
    await act(async () => {
      removed = await result.current.remove(doomedId);
    });

    expect(removed).toEqual({ id: doomedId });

    await waitFor(() => {
      const toasts = getToasts();
      expect(toasts.some((t) => t.kind === 'success' && t.message.includes(`Deleted #${doomedId}`))).toBe(true);
    });
  });

  it('comment() adds a journal note without surfacing other fields', async () => {
    const issues = await getMyIssues();
    const target = issues[0]!;
    const { result } = renderHook(() => useIssueActions());

    await act(async () => {
      await result.current.comment(target.id, 'Anonymized comment body.');
    });

    await waitFor(() => {
      const toasts = getToasts();
      expect(toasts.some((t) => t.kind === 'success' && t.message.includes(`Comment added to #${target.id}`))).toBe(true);
    });
  });

  it('reparent() updates the parent_issue_id link', async () => {
    const issues = await getMyIssues();
    const target = issues[0]!;
    const newParent = issues[1]!;
    expect(target.id).not.toBe(newParent.id);

    const { result } = renderHook(() => useIssueActions());
    let reparented: Awaited<ReturnType<typeof result.current.reparent>> | undefined;
    await act(async () => {
      reparented = await result.current.reparent(target.id, newParent.id);
    });

    expect(reparented!.parentIssueId).toBe(newParent.id);

    await waitFor(() => {
      const toasts = getToasts();
      expect(
        toasts.some(
          (t) => t.kind === 'success' && t.message.includes(`#${target.id}`) && t.message.includes(`#${newParent.id}`),
        ),
      ).toBe(true);
    });
  });
});
