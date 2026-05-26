import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TicketDrawer from '../components/TicketDrawer';
import { mockIssues } from '../data/mockData';
import { clearToasts, getToasts } from '../lib/toast';

describe('<TicketDrawer />', () => {
  beforeEach(() => clearToasts());
  afterEach(() => clearToasts());

  it('shows the selected issue and saves edits', async () => {
    const onSaved = vi.fn();
    render(<TicketDrawer issue={mockIssues[0]} onSaved={onSaved} onClose={() => {}} />);
    expect(screen.getByText(`#${mockIssues[0].id} · ${mockIssues[0].subject}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('switches to quick edit', () => {
    const onQuickEdit = vi.fn();
    render(
      <TicketDrawer
        issue={mockIssues[0]}
        onSaved={() => {}}
        onClose={() => {}}
        onQuickEdit={onQuickEdit}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /quick edit/i }));
    expect(onQuickEdit).toHaveBeenCalled();
  });

  it('opens an inline subtask form and creates a subtask', async () => {
    const issue = mockIssues[0];
    render(<TicketDrawer issue={issue} onSaved={() => {}} onClose={() => {}} />);

    // Form is collapsed by default — only the open button is visible.
    expect(screen.queryByTestId('ticket-drawer-subtask-form')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ticket-drawer-subtask-open'));
    expect(screen.getByTestId('ticket-drawer-subtask-form')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('ticket-drawer-subtask-input'), {
      target: { value: 'Anonymized subtask subject' },
    });
    fireEvent.click(screen.getByTestId('ticket-drawer-subtask-confirm'));

    await waitFor(() => {
      const toasts = getToasts();
      expect(
        toasts.some(
          (t) =>
            t.kind === 'success' &&
            t.message.toLowerCase().includes('subtask') &&
            t.message.includes(`#${issue.id}`),
        ),
      ).toBe(true);
    });

    // Form collapses again after a successful add.
    await waitFor(() => {
      expect(screen.queryByTestId('ticket-drawer-subtask-form')).not.toBeInTheDocument();
    });
  });

  it('posts a comment and clears the textarea on success', async () => {
    const issue = mockIssues[0];
    render(<TicketDrawer issue={issue} onSaved={() => {}} onClose={() => {}} />);

    const textarea = screen.getByTestId('ticket-drawer-comment-input') as HTMLTextAreaElement;
    const postButton = screen.getByTestId('ticket-drawer-comment-post') as HTMLButtonElement;

    // Post button is disabled when the textarea is empty.
    expect(postButton.disabled).toBe(true);

    fireEvent.change(textarea, { target: { value: 'Anonymized journal note.' } });
    expect(postButton.disabled).toBe(false);

    fireEvent.click(postButton);

    await waitFor(() => {
      const toasts = getToasts();
      expect(
        toasts.some(
          (t) =>
            t.kind === 'success' &&
            t.message.toLowerCase().includes('comment') &&
            t.message.includes(`#${issue.id}`),
        ),
      ).toBe(true);
    });

    // Textarea was cleared after success.
    expect(textarea.value).toBe('');
  });
});
