import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useDialogA11y } from '../hooks/useDialogA11y';

function TestDialog({
  onClose,
  autoFocus,
}: {
  onClose: () => void;
  autoFocus?: boolean;
}) {
  const ref = useDialogA11y({ open: true, onClose, autoFocus });
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="title"
      data-testid="dialog-root"
    >
      <h2 id="title">Dialog title</h2>
      <input aria-label="first-field" data-testid="first" />
      <button data-testid="other">Other</button>
    </div>
  );
}

describe('useDialogA11y', () => {
  it('moves focus to the first focusable child on open', () => {
    render(<TestDialog onClose={() => {}} />);
    expect(screen.getByTestId('first')).toHaveFocus();
  });

  it('respects autoFocus=false', () => {
    render(<TestDialog onClose={() => {}} autoFocus={false} />);
    expect(screen.getByTestId('first')).not.toHaveFocus();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<TestDialog onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for other keys', () => {
    const onClose = vi.fn();
    render(<TestDialog onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'a' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('restores focus to the previously-focused element on unmount', () => {
    const opener = document.createElement('button');
    opener.setAttribute('data-testid', 'opener');
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);
    const { unmount } = render(<TestDialog onClose={() => {}} />);
    // Inside the dialog now.
    expect(screen.getByTestId('first')).toHaveFocus();
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
