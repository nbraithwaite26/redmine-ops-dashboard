import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useTimeEntryActions } from '../hooks/useTimeEntryActions';
import { clearToasts, getToasts } from '../lib/toast';
import { getProjects, getTimeEntries } from '../services/redmineApi';

describe('useTimeEntryActions (mock-mode integration)', () => {
  beforeEach(() => clearToasts());
  afterEach(() => clearToasts());

  it('create() logs a new entry and surfaces a success toast', async () => {
    const projects = await getProjects();
    const { result } = renderHook(() => useTimeEntryActions());

    let created: Awaited<ReturnType<typeof result.current.create>> | undefined;
    await act(async () => {
      created = await result.current.create({
        projectId: projects[0]!.id,
        hours: 1.5,
        activity: 'Development',
        spentOn: '2026-05-26',
        comments: 'Anonymized comment',
      });
    });

    expect(created).toBeDefined();
    expect(created!.hours).toBe(1.5);

    await waitFor(() => {
      const toasts = getToasts();
      expect(toasts.some((t) => t.kind === 'success' && t.message.includes('1.5h'))).toBe(true);
    });
  });

  it('save() updates an existing entry and surfaces a toast', async () => {
    const entries = await getTimeEntries();
    expect(entries.length).toBeGreaterThan(0);
    const target = entries[0]!;
    const { result } = renderHook(() => useTimeEntryActions());

    let updated: Awaited<ReturnType<typeof result.current.save>> | undefined;
    await act(async () => {
      updated = await result.current.save(target.id, {
        hours: target.hours + 0.25,
      });
    });

    expect(updated!.hours).toBe(target.hours + 0.25);

    await waitFor(() => {
      const toasts = getToasts();
      expect(
        toasts.some((t) => t.kind === 'success' && t.message.includes(`#${target.id}`)),
      ).toBe(true);
    });
  });

  it('remove() deletes an entry and toasts the id', async () => {
    const projects = await getProjects();
    const { result } = renderHook(() => useTimeEntryActions());

    // Create a doomed entry so other fixtures aren't disturbed.
    let doomed: Awaited<ReturnType<typeof result.current.create>> | undefined;
    await act(async () => {
      doomed = await result.current.create({
        projectId: projects[0]!.id,
        hours: 0.25,
        activity: 'Development',
        spentOn: '2026-05-26',
      });
    });
    expect(doomed).toBeDefined();
    const doomedId = doomed!.id;
    clearToasts();

    await act(async () => {
      const r = await result.current.remove(doomedId);
      expect(r).toEqual({ id: doomedId });
    });

    await waitFor(() => {
      const toasts = getToasts();
      expect(
        toasts.some((t) => t.kind === 'success' && t.message.includes(`#${doomedId}`)),
      ).toBe(true);
    });
  });
});
