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

  // Functional: each row shows the % Done as a progress bar with the right
  // aria-valuenow.
  it('renders a progress bar for every row in the % Done column', () => {
    render(<IssueTable title="Test" issues={mockIssues} />);
    const bars = screen.getAllByRole('progressbar');
    expect(bars.length).toBe(mockIssues.length);
    const expectedValues = mockIssues.map((i) => String(i.doneRatio)).sort();
    const actualValues = bars
      .map((b) => b.getAttribute('aria-valuenow') ?? '0')
      .sort();
    expect(actualValues).toEqual(expectedValues);
  });

  // Integration: every row renders a priority pill, and rows whose priority
  // is High/Urgent/Immediate include an icon inside the pill.
  it('priority pills include an icon for High, Urgent, and Immediate rows', () => {
    render(<IssueTable title="Test" issues={mockIssues} />);
    const pills = screen.getAllByTestId('priority-pill');
    expect(pills.length).toBe(mockIssues.length);
    pills.forEach((pill) => {
      const priority = pill.getAttribute('data-priority');
      const hasIcon = pill.querySelector('svg') !== null;
      if (priority === 'High' || priority === 'Urgent' || priority === 'Immediate') {
        expect(hasIcon).toBe(true);
      } else {
        expect(hasIcon).toBe(false);
      }
    });
  });

  // Integration: the column header is sortable; verify sorting by % Done
  // reorders the rendered progress bars by their aria-valuenow.
  it('sorting by % Done reorders the rendered progress bars', () => {
    render(<IssueTable title="Test" issues={mockIssues} />);
    fireEvent.click(screen.getByText('% Done'));
    const sortedAsc = screen
      .getAllByRole('progressbar')
      .map((b) => Number(b.getAttribute('aria-valuenow') ?? 0));
    expect(sortedAsc).toEqual([...sortedAsc].sort((a, b) => a - b));

    fireEvent.click(screen.getByText('% Done'));
    const sortedDesc = screen
      .getAllByRole('progressbar')
      .map((b) => Number(b.getAttribute('aria-valuenow') ?? 0));
    expect(sortedDesc).toEqual([...sortedDesc].sort((a, b) => b - a));
  });
});
