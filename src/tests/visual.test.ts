import { describe, expect, it } from 'vitest';
import { clampProgress, donutGradient } from '../lib/visual';

describe('donutGradient', () => {
  it('renders a 360deg arc at 100', () => {
    expect(donutGradient(100, '#10B981')).toBe(
      'conic-gradient(#10B981 360deg, #E5E7EB 360deg)',
    );
  });

  it('renders a 0deg arc at 0', () => {
    expect(donutGradient(0, '#10B981')).toBe(
      'conic-gradient(#10B981 0deg, #E5E7EB 0deg)',
    );
  });

  it('renders a 180deg arc at 50', () => {
    expect(donutGradient(50, '#FF0000')).toBe(
      'conic-gradient(#FF0000 180deg, #E5E7EB 180deg)',
    );
  });

  it('clamps above 100', () => {
    expect(donutGradient(150, '#000')).toContain('360deg');
  });

  it('clamps below 0', () => {
    expect(donutGradient(-10, '#000')).toContain('0deg');
  });

  it('uses the provided track color', () => {
    expect(donutGradient(25, '#fff', '#abcdef')).toBe(
      'conic-gradient(#fff 90deg, #abcdef 90deg)',
    );
  });
});

describe('clampProgress', () => {
  it.each([
    [0, 0],
    [50, 50],
    [100, 100],
    [-5, 0],
    [150, 100],
  ])('clamps %i to %i', (input, expected) => {
    expect(clampProgress(input)).toBe(expected);
  });

  it('returns 0 for NaN', () => {
    expect(clampProgress(Number.NaN)).toBe(0);
  });
});
