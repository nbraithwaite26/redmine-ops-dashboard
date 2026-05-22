import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Reports from '../pages/Reports';

describe('<Reports /> (tabbed)', () => {
  it('defaults to the KPI tab when no tab query is present', async () => {
    render(
      <MemoryRouter initialEntries={['/reports']}>
        <Reports />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('panel-kpi')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('tab-kpi')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tab-issues')).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByTestId('panel-issues')).not.toBeInTheDocument();
  });

  it('honors ?tab=issues on initial mount', async () => {
    render(
      <MemoryRouter initialEntries={['/reports?tab=issues']}>
        <Reports />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('panel-issues')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('tab-issues')).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByTestId('panel-kpi')).not.toBeInTheDocument();
  });

  it('clicking a tab swaps the rendered panel', async () => {
    render(
      <MemoryRouter initialEntries={['/reports']}>
        <Reports />
      </MemoryRouter>,
    );
    await waitFor(() => screen.getByTestId('panel-kpi'));
    fireEvent.click(screen.getByTestId('tab-issues'));
    await waitFor(() =>
      expect(screen.getByTestId('panel-issues')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('panel-kpi')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tab-kpi'));
    await waitFor(() =>
      expect(screen.getByTestId('panel-kpi')).toBeInTheDocument(),
    );
  });
});
