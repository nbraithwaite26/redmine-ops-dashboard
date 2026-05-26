import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TicketDrawer from '../components/TicketDrawer';
import { mockIssues } from '../data/mockData';
import { clearToasts, getToasts } from '../lib/toast';
import type { CustomField } from '../types/redmine';

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

  it('renders editable custom field inputs and round-trips edits through Save', async () => {
    // None of the mock issues ship with customFields populated, so we
    // synthesize one that exercises the editable path.
    const base = mockIssues[0]!;
    const customFields: CustomField[] = [
      { id: 11, name: 'Customer', value: 'Anonymized customer' },
      { id: 12, name: 'Story points', value: 5 },
      { id: 13, name: 'Requires review', value: false },
    ];
    const issue = { ...base, customFields };

    const onSaved = vi.fn();
    render(<TicketDrawer issue={issue} onSaved={onSaved} onClose={() => {}} />);

    const textInput = screen.getByTestId('custom-field-11') as HTMLInputElement;
    expect(textInput).toBeInTheDocument();
    expect(textInput.value).toBe('Anonymized customer');

    const numberInput = screen.getByTestId('custom-field-12') as HTMLInputElement;
    expect(numberInput.value).toBe('5');

    const booleanInput = screen.getByTestId('custom-field-13') as HTMLInputElement;
    expect(booleanInput.checked).toBe(false);

    // Edit each kind, then save.
    fireEvent.change(textInput, { target: { value: 'Anonymized edited customer' } });
    fireEvent.change(numberInput, { target: { value: '8' } });
    fireEvent.click(booleanInput);

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const updated = onSaved.mock.calls[0]![0] as { customFields: CustomField[] };
    expect(updated.customFields.find((f) => f.id === 11)?.value).toBe('Anonymized edited customer');
    expect(updated.customFields.find((f) => f.id === 12)?.value).toBe(8);
    expect(updated.customFields.find((f) => f.id === 13)?.value).toBe(true);
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
