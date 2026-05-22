import { useCallback, useState } from 'react';
import type { Issue } from '../types/redmine';

export interface IssueEditorHandlers {
  /** Open the full ticket drawer for this issue. */
  openIssue: (issue: Issue) => void;
  /** Open the lightweight quick-edit popup for this issue. */
  openQuickEdit: (issue: Issue) => void;
  /** Close both surfaces. */
  closeAll: () => void;
  /** Switch from quick-edit → full drawer for the same issue. */
  switchToFullEditor: (issue: Issue) => void;
  /** Switch from full drawer → quick-edit for the same issue. */
  switchToQuickEdit: (issue: Issue) => void;
}

export interface UseIssueEditorResult extends IssueEditorHandlers {
  /** Issue currently shown in the full drawer (or null when closed). */
  openIssueState: Issue | null;
  /** Issue currently shown in the quick-edit popup (or null when closed). */
  quickEditState: Issue | null;
}

/**
 * Encapsulates the open/quick-edit drawer state pattern shared by
 * Dashboard, MyTasks, Tasks, PastDue, and similar pages. Each page used
 * to declare `useState<Issue | null>` twice and wire four separate
 * handlers. This hook collapses that into one call.
 *
 * @example
 * const editor = useIssueEditor();
 * <IssueTable onOpenIssue={editor.openIssue} onQuickEdit={editor.openQuickEdit} />
 * {editor.quickEditState && <QuickEditPopup
 *    issue={editor.quickEditState}
 *    onClose={editor.closeAll}
 *    onOpenFullEditor={editor.switchToFullEditor}
 * />}
 */
export function useIssueEditor(): UseIssueEditorResult {
  const [openIssueState, setOpenIssue] = useState<Issue | null>(null);
  const [quickEditState, setQuickEdit] = useState<Issue | null>(null);

  const openIssue = useCallback((issue: Issue) => {
    setQuickEdit(null);
    setOpenIssue(issue);
  }, []);

  const openQuickEdit = useCallback((issue: Issue) => {
    setOpenIssue(null);
    setQuickEdit(issue);
  }, []);

  const closeAll = useCallback(() => {
    setOpenIssue(null);
    setQuickEdit(null);
  }, []);

  const switchToFullEditor = useCallback((issue: Issue) => {
    setQuickEdit(null);
    setOpenIssue(issue);
  }, []);

  const switchToQuickEdit = useCallback((issue: Issue) => {
    setOpenIssue(null);
    setQuickEdit(issue);
  }, []);

  return {
    openIssueState,
    quickEditState,
    openIssue,
    openQuickEdit,
    closeAll,
    switchToFullEditor,
    switchToQuickEdit,
  };
}
