import { describe, expect, it } from 'vitest';
import {
  findProjectByPath,
  getAllDescendants,
  getDirectChildren,
  slugify,
} from '../lib/projectTree';
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

// AV Engineering (1)
//  └ AIRCRAFT ENGINEERING (2)
//     ├ STC (3)
//     │  ├ STC Project A (4)
//     │  └ STC Project B (5)
//     │     └ STC Sub-leaf (6)
//     └ Custom Engineering Services (7)
//        └ CES Project A (8)
const tree: Project[] = [
  makeProject(1, 'AV Engineering', null),
  makeProject(2, 'AIRCRAFT ENGINEERING', 1),
  makeProject(3, 'STC', 2),
  makeProject(4, 'STC Project A', 3),
  makeProject(5, 'STC Project B', 3),
  makeProject(6, 'STC Sub-leaf', 5),
  makeProject(7, 'Custom Engineering Services', 2),
  makeProject(8, 'CES Project A', 7),
];

describe('slugify', () => {
  it('lowercases, hyphenates, strips punctuation', () => {
    expect(slugify('STC')).toBe('stc');
    expect(slugify('Custom Engineering Services')).toBe('custom-engineering-services');
    expect(slugify('  Aircraft Engineering / CI!  ')).toBe('aircraft-engineering-ci');
  });
});

describe('getDirectChildren', () => {
  it('returns only one level down', () => {
    const kids = getDirectChildren(tree, 2);
    expect(kids.map((p) => p.name).sort()).toEqual([
      'Custom Engineering Services',
      'STC',
    ]);
  });

  it('returns roots when parentId is null', () => {
    expect(getDirectChildren(tree, null).map((p) => p.id)).toEqual([1]);
  });
});

describe('getAllDescendants', () => {
  it('includes every level beneath the root, excluding the root', () => {
    const ids = getAllDescendants(tree, 2).map((p) => p.id).sort((a, b) => a - b);
    expect(ids).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it('counts deep descendants under STC', () => {
    const ids = getAllDescendants(tree, 3).map((p) => p.id).sort((a, b) => a - b);
    expect(ids).toEqual([4, 5, 6]);
  });

  it('returns empty for a leaf', () => {
    expect(getAllDescendants(tree, 6)).toEqual([]);
  });
});

describe('findProjectByPath', () => {
  it('resolves a multi-segment path case-insensitively', () => {
    const found = findProjectByPath(tree, ['av engineering', 'aircraft engineering']);
    expect(found?.id).toBe(2);
  });

  it('returns null when a segment is missing', () => {
    expect(findProjectByPath(tree, ['AV Engineering', 'No Such Child'])).toBeNull();
  });

  it('returns null for an empty path', () => {
    expect(findProjectByPath(tree, [])).toBeNull();
  });
});
