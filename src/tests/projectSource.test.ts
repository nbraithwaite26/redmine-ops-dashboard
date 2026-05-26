import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROJECT_SOURCE,
  findCategoryBySlug,
  getParentCandidates,
  resolveProjectSource,
} from '../services/projectSource';
import { slugify } from '../lib/projectTree';
import type { Project } from '../types/redmine';

function makeProject(id: number, name: string, parentProjectId: number | null): Project {
  return {
    id,
    name,
    identifier: slugify(name),
    description: '',
    status: 'Active',
    parentProjectId,
    createdOn: '2026-01-01',
    updatedOn: '2026-01-01',
  };
}

// **AV Engineering (1) → AIRCRAFT ENGINEERING (2) →
//   STCs (3) → A(4), B(5) → leaf(6)
//   Custom Engineering Services (7) → C(8)
//   Aircraft Engineering Continuous Improvement (9)  [no children]
//   Meetings (10)  [unpinned, appears first by id order]
const projects: Project[] = [
  makeProject(1, '**AV Engineering', null),
  makeProject(2, 'AIRCRAFT ENGINEERING', 1),
  makeProject(3, 'STCs', 2),
  makeProject(4, 'STC Project A', 3),
  makeProject(5, 'STC Project B', 3),
  makeProject(6, 'STC Sub-leaf', 5),
  makeProject(7, 'Custom Engineering Services', 2),
  makeProject(8, 'CES Project A', 7),
  makeProject(9, 'Aircraft Engineering Continuous Improvement', 2),
  makeProject(10, 'Meetings', 2),
];

describe('resolveProjectSource', () => {
  it('resolves the default path to AIRCRAFT ENGINEERING with all its direct children', () => {
    const src = resolveProjectSource(projects);
    expect(src.root?.id).toBe(2);
    expect(src.label).toBe('AIRCRAFT ENGINEERING');
    expect(src.categories.map((c) => c.project.name).sort()).toEqual([
      'Aircraft Engineering Continuous Improvement',
      'Custom Engineering Services',
      'Meetings',
      'STCs',
    ]);
  });

  it('pins the three named categories first, in order, then the rest', () => {
    const src = resolveProjectSource(projects);
    expect(src.categories.map((c) => c.slug)).toEqual([
      'custom-engineering-services',
      'stcs',
      'aircraft-engineering-continuous-improvement',
      'meetings',
    ]);
  });

  it('counts all descendants per category (Q2)', () => {
    const src = resolveProjectSource(projects);
    const byName = Object.fromEntries(src.categories.map((c) => [c.project.name, c.totalProjects]));
    expect(byName['STCs']).toBe(3); // A, B, leaf
    expect(byName['Custom Engineering Services']).toBe(1); // C
    expect(byName['Aircraft Engineering Continuous Improvement']).toBe(0);
  });

  it('totalProjects is all descendants beneath the root', () => {
    expect(resolveProjectSource(projects).totalProjects).toBe(8);
  });

  it('supports swapping the root by id (parent-swapper)', () => {
    const src = resolveProjectSource(projects, { rootId: 3 });
    expect(src.root?.name).toBe('STCs');
    expect(src.categories.map((c) => c.project.name).sort()).toEqual([
      'STC Project A',
      'STC Project B',
    ]);
  });

  it('returns an empty resolution when the root is missing', () => {
    const src = resolveProjectSource(projects, { path: ['Nope', 'Nope'] });
    expect(src.root).toBeNull();
    expect(src.categories).toEqual([]);
    expect(src.totalProjects).toBe(0);
    expect(src.label).toBe(DEFAULT_PROJECT_SOURCE.label);
  });
});

describe('getParentCandidates', () => {
  it('returns only projects that have children', () => {
    const ids = getParentCandidates(projects).map((p) => p.id).sort((a, b) => a - b);
    // 5 (STC Project B) qualifies — it has the sub-leaf (6) beneath it.
    expect(ids).toEqual([1, 2, 3, 5, 7]);
  });
});

describe('findCategoryBySlug', () => {
  it('finds a category by its derived slug', () => {
    const src = resolveProjectSource(projects);
    expect(findCategoryBySlug(src, 'stcs')?.project.id).toBe(3);
    expect(findCategoryBySlug(src, 'custom-engineering-services')?.project.id).toBe(7);
    expect(findCategoryBySlug(src, 'no-such')).toBeNull();
  });
});
