import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TicketDrawer from '../components/TicketDrawer';
import { mockIssues } from '../data/mockData';

describe('<TicketDrawer />', () => {
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
});
