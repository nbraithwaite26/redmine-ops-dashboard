import { useCallback, useEffect, useState } from 'react';
import { loadSelection, saveSelection } from '../lib/teamSelection';
import { useWorkspace } from './useWorkspace';

/**
 * Shared "selected team" state. The Dashboard's team panel is the writer
 * (its picker / per-engineer toggles publish here); every metric card that
 * should be team-scoped is a read-only consumer.
 *
 * Storage and broadcast model mirror `useWorkspace`:
 *   - Persisted per-workspace in localStorage (one slot per workspace, so
 *     each workspace remembers its own team).
 *   - Cross-component sync via a CustomEvent so we don't have to thread a
 *     Provider into App.tsx for one shared array.
 *
 * `selectedIds === null` means "not yet hydrated" — consumers should treat
 * that as "no team filter applied" (i.e. show global numbers until the
 * panel finishes initializing).
 */

const CHANGE_EVENT = 'rod.selectedTeam.change';

interface SelectedTeamChangeDetail {
  workspace: string;
  ids: number[];
}

export function useSelectedTeam(): {
  selectedIds: number[] | null;
  setSelectedIds: (ids: number[]) => void;
} {
  const { workspace } = useWorkspace();
  const [selectedIds, setLocal] = useState<number[] | null>(() =>
    loadSelection(workspace),
  );

  // Reload from storage whenever the active workspace changes. Each
  // workspace owns its own persisted selection.
  useEffect(() => {
    setLocal(loadSelection(workspace));
  }, [workspace]);

  // Listen for cross-component broadcasts so other consumers see updates
  // immediately (and we don't depend on context).
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<SelectedTeamChangeDetail>).detail;
      if (detail?.workspace === workspace) {
        setLocal(Array.isArray(detail.ids) ? detail.ids : null);
      }
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, [workspace]);

  const setSelectedIds = useCallback(
    (ids: number[]) => {
      saveSelection(workspace, ids);
      setLocal(ids);
      window.dispatchEvent(
        new CustomEvent<SelectedTeamChangeDetail>(CHANGE_EVENT, {
          detail: { workspace, ids },
        }),
      );
    },
    [workspace],
  );

  return { selectedIds, setSelectedIds };
}
