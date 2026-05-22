import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ReorderableSection from '../components/ReorderableSection';
import { useSectionOrder } from '../hooks/useSectionOrder';

const SECTIONS = ['alpha', 'beta', 'gamma'];

function ReorderablePage() {
  const { order, moveUp, moveDown } = useSectionOrder({
    storageKey: 'rod.test.integration',
    defaultOrder: SECTIONS,
  });
  return (
    <div>
      {order.map((id, idx) => (
        <ReorderableSection
          key={id}
          id={id}
          title={id}
          canMoveUp={idx > 0}
          canMoveDown={idx < order.length - 1}
          onMoveUp={() => moveUp(id)}
          onMoveDown={() => moveDown(id)}
        >
          <div data-testid={`body-${id}`}>{id} body</div>
        </ReorderableSection>
      ))}
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('ReorderableSection + useSectionOrder (integration)', () => {
  it('renders sections in default order on first mount', () => {
    render(<ReorderablePage />);
    const rendered = screen
      .getAllByText(/^(alpha|beta|gamma)$/i)
      .filter((el) => el.tagName === 'H2')
      .map((el) => el.textContent);
    expect(rendered).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('clicking move-down swaps the section with the one below it', () => {
    render(<ReorderablePage />);
    fireEvent.click(screen.getByRole('button', { name: /move alpha down/i }));
    const rendered = screen
      .getAllByText(/^(alpha|beta|gamma)$/i)
      .filter((el) => el.tagName === 'H2')
      .map((el) => el.textContent);
    expect(rendered).toEqual(['beta', 'alpha', 'gamma']);
  });

  it('order persists to localStorage', () => {
    render(<ReorderablePage />);
    fireEvent.click(screen.getByRole('button', { name: /move gamma up/i }));
    const stored = window.localStorage.getItem('rod.test.integration');
    expect(stored).toBe(JSON.stringify(['alpha', 'gamma', 'beta']));
  });

  it('move-up at the top is disabled', () => {
    render(<ReorderablePage />);
    expect(
      screen.getByRole('button', { name: /move alpha up/i }),
    ).toBeDisabled();
  });

  it('move-down at the bottom is disabled', () => {
    render(<ReorderablePage />);
    expect(
      screen.getByRole('button', { name: /move gamma down/i }),
    ).toBeDisabled();
  });
});
