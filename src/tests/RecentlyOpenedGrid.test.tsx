import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import RecentlyOpenedGrid from '../components/RecentlyOpenedGrid';

const items = [
  { id: 'a', title: 'Alpha', type: 'Workspace', description: 'first', to: '/alpha' },
  { id: 'b', title: 'Beta', type: 'Tool', description: 'second', to: '/beta' },
];

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}</div>;
}

describe('<RecentlyOpenedGrid />', () => {
  it('renders one card per item with title, type, description, and avatar', () => {
    render(
      <MemoryRouter>
        <RecentlyOpenedGrid items={items} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.getByText('second')).toBeInTheDocument();
    // Letter avatars
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('clicking a card navigates to its route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={<RecentlyOpenedGrid items={items} />}
          />
          <Route path="/alpha" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Alpha' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/alpha');
  });

  it('the bookmark button does not trigger card navigation', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={<RecentlyOpenedGrid items={items} />}
          />
          <Route path="/alpha" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /bookmark alpha/i }));
    // Location did not change.
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
  });
});
