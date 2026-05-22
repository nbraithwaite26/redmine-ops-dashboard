import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressBar from '../components/ProgressBar';

describe('<ProgressBar />', () => {
  it('renders the value as both the label and aria-valuenow', () => {
    render(<ProgressBar value={40} ariaLabel="40% done" />);
    expect(screen.getByText('40%')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '40');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-label', '40% done');
  });

  it.each([
    [0, '0%'],
    [50, '50%'],
    [100, '100%'],
  ])('shows %i as the percent label', (value, label) => {
    render(<ProgressBar value={value} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('clamps a value above 100', () => {
    render(<ProgressBar value={250} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('clamps a value below 0', () => {
    render(<ProgressBar value={-20} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('fill width matches the clamped percentage', () => {
    render(<ProgressBar value={37} />);
    const fill = screen.getByTestId('progress-bar-fill');
    expect(fill.getAttribute('style')).toContain('width: 37%');
  });

  it('hides the label when showLabel=false', () => {
    render(<ProgressBar value={50} showLabel={false} />);
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });
});
