import type { Project } from '../types/redmine';

/**
 * Pure helpers for deriving a project hierarchy from the flat
 * Project[] list the API returns. The tree is implied by
 * Project.parentProjectId; nothing here does I/O.
 */

/** Lowercase, hyphenate, strip non-url-safe chars. Stable for route params. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Direct children of a parent (one level down). */
export function getDirectChildren(
  projects: Project[],
  parentId: number | null,
): Project[] {
  return projects.filter((p) => p.parentProjectId === parentId);
}

/**
 * Every project beneath rootId at any depth (excludes rootId itself).
 * Guards against cycles via a visited set.
 */
export function getAllDescendants(projects: Project[], rootId: number): Project[] {
  const byParent = new Map<number, Project[]>();
  for (const p of projects) {
    if (p.parentProjectId === null) continue;
    const bucket = byParent.get(p.parentProjectId);
    if (bucket) bucket.push(p);
    else byParent.set(p.parentProjectId, [p]);
  }

  const out: Project[] = [];
  const seen = new Set<number>([rootId]);
  const stack = [...(byParent.get(rootId) ?? [])];
  while (stack.length) {
    const node = stack.pop()!;
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    out.push(node);
    const kids = byParent.get(node.id);
    if (kids) stack.push(...kids);
  }
  return out;
}

/**
 * Walk a name path from the roots down. Each segment matches a child's
 * name case-insensitively. Returns the project at the end of the path,
 * or null if any segment is missing.
 *
 * e.g. findProjectByPath(projects, ['AV Engineering', 'AIRCRAFT ENGINEERING'])
 */
export function findProjectByPath(
  projects: Project[],
  path: string[],
): Project | null {
  if (path.length === 0) return null;
  let parentId: number | null = null;
  let current: Project | null = null;
  for (const segment of path) {
    const target = segment.trim().toLowerCase();
    const match = projects.find(
      (p) => p.parentProjectId === parentId && p.name.trim().toLowerCase() === target,
    );
    if (!match) return null;
    current = match;
    parentId = match.id;
  }
  return current;
}
