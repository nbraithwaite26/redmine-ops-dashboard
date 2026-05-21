import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import IssueTable from '../components/IssueTable';
import { mockIssues } from '../data/mockData';

describe('<IssueTable />', () => {
  it('renders rows from issues', () => {
    render(<IssueTable title="Test" issues={mockIssues} />);
    expect(screen.getByText(/Wiring review/i)).toBeInTheDocument();
    expect(screen.getByText(/CRM is down/i)).toBeInTheDocument();
  });

  it('filters by search query', () => {
    render(<IssueTable title="Test" issues={mockIssues} />);
    const input = screen.getByLabelText(/search test/i);
    fireEvent.change(input, { target: { value: 'CRM' } });
    expect(screen.getByText(/CRM is down/i)).toBeInTheDocument();
    expect(screen.queryByText(/Wiring review/i)).not.toBeInTheDocument();
  });

  it('invokes onQuickEdit when the row pencil is clicked', () => {
    const onQuickEdit = vi.fn();
    render(<IssueTable title="Test" issues={mockIssues} onQuickEdit={onQuickEdit} />);
    const firstQuickEdit = screen.getAllByRole('button', { name: /quick edit issue/i })[0];
    fireEvent.click(firstQuickEdit);
    expect(onQuickEdit).toHaveBeenCalledTimes(1);
  });

  it('invokes onOpenIssue when an issue id is clicked', () => {
    const onOpenIssue = vi.fn();
    render(<IssueTable title="Test" issues={mockIssues} onOpenIssue={onOpenIssue} />);
    fireEvent.click(screen.getByText(`#${mockIssues[0].id}`));
    expect(onOpenIssue).toHaveBeenCalledWith(expect.objectContaining({ id: mockIssues[0].id }));
  });

  it('toggles all rows via the header checkbox', () => {
    render(<IssueTable title="Test" issues={mockIssues} />);
    const headerCheckbox = screen.getByLabelText(/select all/i);
    fireEvent.click(headerCheckbox);
    expect(screen.getByText(/selected/i)).toBeInTheDocument();
  });
});
