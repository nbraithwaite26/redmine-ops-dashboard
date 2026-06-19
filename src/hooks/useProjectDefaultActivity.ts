import { useCallback, useEffect, useState } from 'react';
import { useWorkspace } from './useWorkspace';

/**
 * Per-(workspace, project) default time-entry activity. Persisted in
 * localStorage so each project remembers its own "log time under this
 * activity by default" preference. The timesheet uses this so cells save
 * without prompting once the project has a default picked.
 */

const STORAGE_KEY = 'rod.timesheet.projectDefaultActivity';
const CHANGE_EVENT = 'rod.timesheet.projectDefaultActivity.change';

type Map = Record<string, string>;

function storageKeyFor(workspace: string, projectId: number): string {
  return `${workspace}::${projectId}`;
}

function readAll(): Map {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Map) : {};
  } catch {
    return {};
  }
}

function writeAll(next: Map): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function useProjectDefaultActivity(projectId: number | null): {
  /** The persisted default for the active workspace + project. `null` if unset. */
  activity: string | null;
  /** Persist a new default. Pass `null` to clear it. */
  setActivity: (next: string | null) => void;
} {
  const { workspace } = useWorkspace();
  const [map, setMap] = useState<Map>(readAll);

  useEffect(() => {
    function onChange() {
      setMap(readAll());
    }
    window.addEventListener(CHANGE_EVENT, onChange);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setMap(readAll());
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const activity =
    projectId === null ? null : map[storageKeyFor(workspace, projectId)] ?? null;

  const setActivity = useCallback(
    (next: string | null) => {
      if (projectId === null) return;
      const key = storageKeyFor(workspace, projectId);
      setMap((prev) => {
        const updated = { ...prev };
        if (next === null || next === '') delete updated[key];
        else updated[key] = next;
        writeAll(updated);
        // Notify other components in the same tab.
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
        return updated;
      });
    },
    [projectId, workspace],
  );

  return { activity, setActivity };
}
