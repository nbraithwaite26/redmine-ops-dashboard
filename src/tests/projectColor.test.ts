import { describe, expect, it } from 'vitest';
import { projectColor } from '../lib/projectColor';

describe('projectColor', () => {
  it('maps STC projects to blue', () => {
    expect(projectColor('STC Program').tone).toBe('stc');
    expect(projectColor('Boeing 737 STC Approval').tone).toBe('stc');
    expect(projectColor('STCs in flight').tone).toBe('stc');
  });

  it('maps DDP projects to green', () => {
    expect(projectColor('DDP Workflow').tone).toBe('ddp');
    expect(projectColor('Avionica DDPs Q3').tone).toBe('ddp');
  });

  it('maps Continuous Improvement projects to amber (ci)', () => {
    expect(projectColor('Aircraft Engineering Continuous Improvement').tone).toBe('ci');
    expect(projectColor('Continuous Improvement Meeting').tone).toBe('ci');
  });

  it('falls back to the default gradient for unmatched names', () => {
    const c = projectColor('Equipment', 42);
    expect(c.tone).toBe('default');
    expect(c.gradient).toMatch(/gradient/);
  });

  it('does not false-match keywords inside unrelated words', () => {
    // "estcoast" contains "stc" but not as a standalone token.
    expect(projectColor('estcoast widget').tone).toBe('default');
    // "addparts" contains "ddp"? no — "dpa" not "ddp". Use a real false positive:
    expect(projectColor('riddpath dataset').tone).toBe('default');
  });

  it('returns hex colors usable for stripes / dots', () => {
    expect(projectColor('STC').hex).toMatch(/^#[0-9a-f]{6}$/i);
    expect(projectColor('DDP').hex).toMatch(/^#[0-9a-f]{6}$/i);
    expect(projectColor('Continuous Improvement').hex).toMatch(/^#[0-9a-f]{6}$/i);
    expect(projectColor('other').hex).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
