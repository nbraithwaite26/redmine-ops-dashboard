import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SecondaryNav from '../components/SecondaryNav';

describe('<SecondaryNav />', () => {
  it('filters the workspace list', () => {
    render(
      <MemoryRouter>
        <SecondaryNav />
      </MemoryRouter>,
    );
    expect(screen.getByText('Project Builder')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/filter workspace list/i), {
      target: { value: 'past' },
    });
    expect(screen.getByText('Past Due Tasks')).toBeInTheDocument();
    expect(screen.queryByText('Project Builder')).not.toBeInTheDocument();
  });

  it('highlights only the Resource Planning entry when on /resources/personal', () => {
    render(
      <MemoryRouter initialEntries={['/resources/personal']}>
        <SecondaryNav />
      </MemoryRouter>,
    );
    const personal = screen.getByRole('link', { name: 'Resource Planning' });
    const team = screen.getByRole('link', { name: 'Team Workload' });
    expect(personal).toHaveAttribute('aria-current', 'page');
    expect(team).not.toHaveAttribute('aria-current', 'page');
  });

  it('highlights only the Team Workload entry when on /resources/team', () => {
    render(
      <MemoryRouter initialEntries={['/resources/team']}>
        <SecondaryNav />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Team Workload' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Resource Planning' })).not.toHaveAttribute('aria-current', 'page');
  });

  it('highlights only the KPI Tracker entry when /reports?tab=kpi is active', () => {
    render(
      <MemoryRouter initialEntries={['/reports?tab=kpi']}>
        <SecondaryNav />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'KPI Tracker' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Issue Reports' })).not.toHaveAttribute('aria-current', 'page');
  });

  it('highlights only the Issue Reports entry when /reports?tab=issues is active', () => {
    render(
      <MemoryRouter initialEntries={['/reports?tab=issues']}>
        <SecondaryNav />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Issue Reports' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'KPI Tracker' })).not.toHaveAttribute('aria-current', 'page');
  });
});
