import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

describe('<Sidebar /> (collapsed vs expanded)', () => {
  it('renders labels next to icons when expanded', () => {
    render(
      <MemoryRouter>
        <Sidebar collapsed={false} onToggle={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('primary-sidebar')).toHaveAttribute(
      'data-collapsed',
      'false',
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Resource Management')).toBeInTheDocument();
  });

  it('hides labels when collapsed', () => {
    render(
      <MemoryRouter>
        <Sidebar collapsed={true} onToggle={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('primary-sidebar')).toHaveAttribute(
      'data-collapsed',
      'true',
    );
    expect(screen.queryByText('Home')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('the in-sidebar chevron calls onToggle when expanded', () => {
    const onToggle = vi.fn();
    render(
      <MemoryRouter>
        <Sidebar collapsed={false} onToggle={onToggle} />
      </MemoryRouter>,
    );
    const chevron = screen.getByRole('button', { name: /collapse sidebar/i });
    fireEvent.click(chevron);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows the title attribute on collapsed icons for keyboard hover hints', () => {
    render(
      <MemoryRouter>
        <Sidebar collapsed={true} onToggle={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByTitle('Home')).toBeInTheDocument();
    expect(screen.getByTitle('Dashboard')).toBeInTheDocument();
  });
});
