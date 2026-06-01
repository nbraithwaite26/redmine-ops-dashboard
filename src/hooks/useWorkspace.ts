import { useCallback, useEffect, useState } from 'react';

/**
 * The dashboard supports two top-level "workspace" modes that determine
 * which defaults apply to dependent UI (team selection, metric scope,
 * etc.). The selection persists in localStorage.
 *
 *   - 'eng' (Engineering Workspace)
 *       Defaults to the (eng) Aircraft team. Surfaces engineering work.
 *   - 'ops' (Service Operations Workspace)
 *       Defaults to ALL teams. The broader operational view.
 *
 * Components subscribe via `useWorkspace()` — every reader gets the same
 * value because we publish a CustomEvent on change. That keeps the
 * dependency-free hook in sync across tabs/instances without pulling in
 * React context (which would force a Provider into App.tsx for one bit).
 */

export type Workspace = 'eng' | 'ops';

export const WORKSPACES: { id: Workspace; label: string }[] = [
  { id: 'eng', label: 'Engineering Workspace' },
  { id: 'ops', label: 'Service Operations Workspace' },
];

const STORAGE_KEY = 'rod.workspace';
const CHANGE_EVENT = 'rod.workspace.change';
const DEFAULT_WORKSPACE: Workspace = 'eng';

function readStored(): Workspace {
  if (typeof window === 'undefined') return DEFAULT_WORKSPACE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'eng' || raw === 'ops') return raw;
  } catch {
    // localStorage can throw in privacy mode — fall through.
  }
  return DEFAULT_WORKSPACE;
}

function writeStored(w: Workspace): void {
  try {
    localStorage.setItem(STORAGE_KEY, w);
  } catch {
    // Best-effort persistence.
  }
}

export function useWorkspace(): {
  workspace: Workspace;
  setWorkspace: (w: Workspace) => void;
  workspaces: typeof WORKSPACES;
} {
  const [workspace, setWorkspaceState] = useState<Workspace>(readStored);

  useEffect(() => {
    // Sync this instance when another component publishes a change.
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<Workspace>).detail;
      if (detail === 'eng' || detail === 'ops') setWorkspaceState(detail);
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    // And when another tab changes it via localStorage.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'eng' || e.newValue === 'ops')) {
        setWorkspaceState(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setWorkspace = useCallback((w: Workspace) => {
    writeStored(w);
    setWorkspaceState(w);
    window.dispatchEvent(new CustomEvent<Workspace>(CHANGE_EVENT, { detail: w }));
  }, []);

  return { workspace, setWorkspace, workspaces: WORKSPACES };
}
