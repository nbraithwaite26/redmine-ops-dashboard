import { useEffect, useRef } from 'react';

interface Args {
  /** Whether the dialog is currently open. */
  open: boolean;
  /** Called when the user presses Escape inside the dialog. */
  onClose: () => void;
  /**
   * If true, focus moves to the first focusable element inside the dialog
   * on open. Defaults to true.
   */
  autoFocus?: boolean;
}

/**
 * Common accessibility wiring for modal-style dialogs / popups / drawers:
 *
 *  - ESC dismisses the dialog.
 *  - The first focusable element inside the dialog gets focus on open.
 *  - Focus returns to whatever element was focused before the dialog
 *    opened when the dialog closes.
 *
 * Attach the returned ref to the dialog root element.
 *
 * @example
 * const dialogRef = useDialogA11y({ open: true, onClose: handleClose });
 * <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="my-title">
 *   ...
 * </div>
 */
export function useDialogA11y({ open, onClose, autoFocus = true }: Args) {
  const ref = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Capture the element that was focused before the dialog opened so we
  // can restore focus on close.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
    if (autoFocus && ref.current) {
      const first = ref.current.querySelector<HTMLElement>(
        'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])',
      );
      first?.focus();
    }
    return () => {
      // Restore focus to whatever the caller had focused. Guard against the
      // case where the previous element has since been detached.
      const target = previouslyFocused.current;
      if (target && document.body.contains(target)) {
        target.focus();
      }
    };
  }, [open, autoFocus]);

  // ESC closes the dialog.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return ref;
}
