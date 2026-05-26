import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Home from '../pages/Home';
import { currentMockUser } from '../data/mockData';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

describe('<Home /> Codex-style landing', () => {
  it('renders the slate gradient hero with the personalized greeting', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    const hero = screen.getByTestId('home-hero');
    expect(hero).toBeInTheDocument();
    expect(hero).toHaveTextContent('Welcome back,');
    // Greeting is hydrated from getCurrentUser() which is async in real
    // mode and synchronous-ish in mock mode. Wait for it.
    await waitFor(() => expect(hero).toHaveTextContent(currentMockUser.name));
  });

  it('hero includes a workspace selector with at least the Ops option', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    const select = screen.getByLabelText(/active workspace/i) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    const options = Array.from(select.options).map((o) => o.textContent);
    expect(options).toContain('Service Operations Workspace');
  });

  it('renders the 4-card headline metrics row', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByText(/tasks assigned to you/i)).toBeInTheDocument(),
    );
    const metricsBlock = screen.getByTestId('home-headline-metrics');
    expect(metricsBlock).toBeInTheDocument();
    // 4 conic rings — one per headline metric card.
    expect(
      metricsBlock.querySelectorAll('[data-testid="conic-ring"]'),
    ).toHaveLength(4);
  });

  it('renders the Recently opened workspaces grid', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText('Recently opened workspaces')).toBeInTheDocument();
    expect(screen.getByTestId('recently-opened-grid')).toBeInTheDocument();
  });

  it('does NOT render the old "Recently opened files" section', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Recently opened files')).not.toBeInTheDocument();
  });

  it('renders the Tools section with the expected card count', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText('Tools')).toBeInTheDocument();
    // 9 tool cards in the new design.
    const toolCards = screen
      .getAllByRole('button')
      .filter((b) => b.textContent?.includes('My Tasks') ||
                     b.textContent?.includes('Past Due Tasks') ||
                     b.textContent?.includes('Resource Planner') ||
                     b.textContent?.includes('Time Tracking') ||
                     b.textContent?.includes('Project Builder') ||
                     b.textContent?.includes('KPI Tracker') ||
                     b.textContent?.includes('Reports') ||
                     b.textContent?.includes('Calendar') ||
                     b.textContent?.includes('API Settings'));
    expect(toolCards.length).toBeGreaterThanOrEqual(9);
  });

  it('clicking a tool card navigates to its destination', () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/home" element={<Home />} />
          <Route path="/tasks" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    const myTasksTool = screen
      .getAllByRole('button')
      .find((b) =>
        b.textContent?.includes('My Tasks') &&
        b.textContent?.includes('Issues assigned to you'),
      )!;
    fireEvent.click(myTasksTool);
    expect(screen.getByTestId('location')).toHaveTextContent('/tasks');
  });
});
