import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import DashboardCard from '../components/DashboardCard';
import type { DashboardMetric } from '../types/redmine';

const sampleMetric: DashboardMetric = {
  id: 'sample',
  title: 'Sample metric',
  value: 12,
  total: 20,
  progress: 60,
  statusLabel: '3 In Progress',
  statusColor: 'blue',
  color: '#8B5CF6',
  caption: 'open',
  route: '/my-tasks',
};

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

describe('<DashboardCard /> (metric prop variant)', () => {
  it('renders title, value/total label, status pill, and caption', () => {
    render(
      <MemoryRouter>
        <DashboardCard metric={sampleMetric} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Sample metric')).toBeInTheDocument();
    expect(screen.getByText('12/20')).toBeInTheDocument();
    expect(screen.getByText('3 In Progress')).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
  });

  it('omits the / total when total is undefined', () => {
    const { container } = render(
      <MemoryRouter>
        <DashboardCard metric={{ ...sampleMetric, total: undefined }} />
      </MemoryRouter>,
    );
    expect(container.textContent).toContain('12');
    expect(container.textContent).not.toContain('12/');
  });

  it('navigates to metric.route when the card is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={<DashboardCard metric={sampleMetric} />}
          />
          <Route path="/my-tasks" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /sample metric/i }));
    expect(screen.getByTestId('location')).toHaveTextContent('/my-tasks');
  });

  it('does not navigate when metric has no route', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={<DashboardCard metric={{ ...sampleMetric, route: undefined }} />}
          />
          <Route path="/my-tasks" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    const card = container.querySelector('.card');
    expect(card).not.toHaveAttribute('role', 'button');
  });

  it('renders a conic-gradient ring sized and colored from the metric', () => {
    render(
      <MemoryRouter>
        <DashboardCard metric={sampleMetric} />
      </MemoryRouter>,
    );
    const ring = screen.getByTestId('conic-ring');
    // Ring uses the metric color in its conic-gradient inline style.
    expect(ring.getAttribute('style')).toContain('#8B5CF6');
    // aria-label includes the rounded percentage for screen readers.
    expect(ring).toHaveAttribute('aria-label', '12/20 (60%)');
  });

  it('three-dot menu click does not trigger card navigation', () => {
    const onClick = vi.fn();
    render(
      <MemoryRouter>
        <DashboardCard
          metric={{ ...sampleMetric, route: undefined }}
          onClick={onClick}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /card menu/i }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('<DashboardCard /> (legacy prop variant)', () => {
  it('still renders title + status + visual slot for callers that pass children/visual', () => {
    render(
      <MemoryRouter>
        <DashboardCard
          title="Legacy card"
          status="Active"
          statusColor="green"
          visual={<div data-testid="custom-visual">Custom</div>}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Legacy card')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByTestId('custom-visual')).toBeInTheDocument();
  });

  it('legacy onClick fires when the card body is clicked', () => {
    const onClick = vi.fn();
    render(
      <MemoryRouter>
        <DashboardCard title="Legacy" visual={<span>v</span>} onClick={onClick} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /legacy/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
