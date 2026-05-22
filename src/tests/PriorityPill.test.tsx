import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PriorityPill from '../components/PriorityPill';
import { priorityPill } from '../lib/format';
import type { IssuePriority } from '../types/redmine';

describe('priorityPill (class helper)', () => {
  it.each<[IssuePriority, string]>([
    ['Low', 'pill-gray'],
    ['Normal', 'pill-blue'],
    ['High', 'pill-orange'],
    ['Urgent', 'pill-red'],
    ['Immediate', 'pill-red'],
  ])('%s -> %s', (priority, expected) => {
    expect(priorityPill(priority)).toBe(expected);
  });
});

describe('<PriorityPill />', () => {
  it.each<IssuePriority>(['High', 'Urgent', 'Immediate'])(
    'renders an alert-triangle icon for %s priority',
    (priority) => {
      render(<PriorityPill priority={priority} />);
      const pill = screen.getByTestId('priority-pill');
      expect(pill).toHaveAttribute('data-priority', priority);
      // lucide-react renders an SVG; querySelector is the simplest probe.
      expect(pill.querySelector('svg')).not.toBeNull();
    },
  );

  it.each<IssuePriority>(['Low', 'Normal'])(
    'does NOT render an icon for %s priority',
    (priority) => {
      render(<PriorityPill priority={priority} />);
      const pill = screen.getByTestId('priority-pill');
      expect(pill.querySelector('svg')).toBeNull();
    },
  );

  it('always renders the priority label text', () => {
    render(<PriorityPill priority="Urgent" />);
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('applies the correct pill class based on the priority', () => {
    const { rerender } = render(<PriorityPill priority="High" />);
    expect(screen.getByTestId('priority-pill').className).toContain('pill-orange');
    rerender(<PriorityPill priority="Low" />);
    expect(screen.getByTestId('priority-pill').className).toContain('pill-gray');
  });
});
