import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import QuickEditPopup from '../components/QuickEditPopup';
import { mockIssues } from '../data/mockData';

describe('<QuickEditPopup />', () => {
  it('renders fields seeded from the issue', () => {
    render(
      <QuickEditPopup
        issue={mockIssues[0]}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    expect(screen.getByDisplayValue(mockIssues[0].priority)).toBeInTheDocument();
    expect(screen.getByDisplayValue(String(mockIssues[0].doneRatio))).toBeInTheDocument();
  });

  it('calls onSaved when Save quick edit is clicked', async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(
      <QuickEditPopup
        issue={mockIssues[0]}
        onSaved={onSaved}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /save quick edit/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalled();
  });

  it('routes to the full ticket editor', () => {
    const onOpenFullEditor = vi.fn();
    render(
      <QuickEditPopup
        issue={mockIssues[0]}
        onClose={() => {}}
        onSaved={() => {}}
        onOpenFullEditor={onOpenFullEditor}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /open full ticket editor/i }));
    expect(onOpenFullEditor).toHaveBeenCalledTimes(1);
  });
});
