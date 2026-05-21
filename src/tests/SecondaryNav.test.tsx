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
});
