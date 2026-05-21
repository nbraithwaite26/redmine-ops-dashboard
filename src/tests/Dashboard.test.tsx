import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';

describe('<Dashboard />', () => {
  it('renders the overview tabs and metric cards', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Your Work')).toBeInTheDocument();
    expect(screen.getByText("Your Team's Work")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/Tasks assigned to you/i)).toBeInTheDocument(),
    );
  });

  it('switches dashboard tabs', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Project Health'));
    expect(screen.getByText('Project Health')).toBeInTheDocument();
  });
});
