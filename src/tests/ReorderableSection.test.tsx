import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ReorderableSection from '../components/ReorderableSection';

describe('<ReorderableSection />', () => {
  it('renders title, subtitle, and children', () => {
    render(
      <ReorderableSection
        id="x"
        title="Section X"
        subtitle="sub"
        canMoveUp
        canMoveDown
        onMoveUp={() => {}}
        onMoveDown={() => {}}
      >
        <div>child</div>
      </ReorderableSection>,
    );
    expect(screen.getByTestId('section-x')).toBeInTheDocument();
    expect(screen.getByText('Section X')).toBeInTheDocument();
    expect(screen.getByText('sub')).toBeInTheDocument();
    expect(screen.getByText('child')).toBeInTheDocument();
  });

  it('calls onMoveUp when the up arrow is clicked', () => {
    const onMoveUp = vi.fn();
    render(
      <ReorderableSection
        id="x"
        title="X"
        canMoveUp
        canMoveDown
        onMoveUp={onMoveUp}
        onMoveDown={() => {}}
      >
        <div />
      </ReorderableSection>,
    );
    fireEvent.click(screen.getByRole('button', { name: /move x up/i }));
    expect(onMoveUp).toHaveBeenCalledTimes(1);
  });

  it('calls onMoveDown when the down arrow is clicked', () => {
    const onMoveDown = vi.fn();
    render(
      <ReorderableSection
        id="x"
        title="X"
        canMoveUp
        canMoveDown
        onMoveUp={() => {}}
        onMoveDown={onMoveDown}
      >
        <div />
      </ReorderableSection>,
    );
    fireEvent.click(screen.getByRole('button', { name: /move x down/i }));
    expect(onMoveDown).toHaveBeenCalledTimes(1);
  });

  it('disables the up arrow at the top of the list', () => {
    render(
      <ReorderableSection
        id="x"
        title="X"
        canMoveUp={false}
        canMoveDown
        onMoveUp={() => {}}
        onMoveDown={() => {}}
      >
        <div />
      </ReorderableSection>,
    );
    expect(screen.getByRole('button', { name: /move x up/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /move x down/i })).not.toBeDisabled();
  });

  it('renders the actions slot in the header', () => {
    render(
      <ReorderableSection
        id="x"
        title="X"
        canMoveUp
        canMoveDown
        onMoveUp={() => {}}
        onMoveDown={() => {}}
        actions={<button>Export</button>}
      >
        <div />
      </ReorderableSection>,
    );
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });
});
