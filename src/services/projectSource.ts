import type { Project } from '../types/redmine';
import {
  findProjectByPath,
  getAllDescendants,
  getDirectChildren,
  slugify,
} from '../lib/projectTree';

/**
 * Frontend adapter that isolates the (currently fixed) project source path.
 *
 * This is the single swap-point for project-tree sourcing. It presumes NO
 * backend contract — it derives everything from the flat Project[] that
 * `getProjects()` already returns, by walking parentProjectId. When/if the
 * backend exposes a dedicated "subprojects under X" endpoint, only this
 * module changes; the pages and components stay as-is.
 *
 * CR #15.
 */

/**
 * The default project source. Held in frontend code, not an env contract.
 * The leading `**` is part of the real Redmine project name, not emphasis.
 */
export const DEFAULT_PROJECT_SOURCE = {
  path: ['**AV Engineering', 'AIRCRAFT ENGINEERING'] as string[],
  label: '**AV Engineering / AIRCRAFT ENGINEERING',
};

/**
 * Categories the user wants surfaced first (by slug). When present among the
 * resolved categories, these float to the top in this order; everything else
 * follows in natural order. Matched by slug so trailing spaces / casing in the
 * real Redmine names ("STCs", "Aircraft Engineering Continuous Improvement ")
 * don't matter.
 */
export const PINNED_CATEGORY_SLUGS = [
  'custom-engineering-services',
  'stcs',
  'aircraft-engineering-continuous-improvement',
];

function pinnedFirst(categories: ProjectCategory[]): ProjectCategory[] {
  const rank = (slug: string) => {
    const i = PINNED_CATEGORY_SLUGS.indexOf(slug);
    return i === -1 ? PINNED_CATEGORY_SLUGS.length : i;
  };
  return [...categories].sort((a, b) => rank(a.slug) - rank(b.slug));
}

export interface ProjectCategory {
  /** The category project node (a direct child of the resolved root). */
  project: Project;
  /** Route-safe slug derived from the category name. */
  slug: string;
  /** Count of all projects beneath this category at any depth. */
  totalProjects: number;
}

export interface ResolvedProjectSource {
  /** The resolved root project (e.g. AIRCRAFT ENGINEERING), or null. */
  root: Project | null;
  /** Human label for the resolved root. */
  label: string;
  /** Direct children of the root, each with a descendant count. */
  categories: ProjectCategory[];
  /** Count of all projects beneath the root at any depth. */
  totalProjects: number;
}

interface ResolveOptions {
  /** Resolve the root by name path. Defaults to DEFAULT_PROJECT_SOURCE.path. */
  path?: string[];
  /** Resolve the root by id directly (takes precedence over path). Used by
   *  the parent-swapper picker, which already knows the chosen project. */
  rootId?: number;
}

function toCategory(projects: Project[], project: Project): ProjectCategory {
  return {
    project,
    slug: slugify(project.name),
    totalProjects: getAllDescendants(projects, project.id).length,
  };
}

/** Resolve the source root + its categories from a flat project list. */
export function resolveProjectSource(
  projects: Project[],
  options: ResolveOptions = {},
): ResolvedProjectSource {
  let root: Project | null = null;
  if (options.rootId !== undefined) {
    root = projects.find((p) => p.id === options.rootId) ?? null;
  } else {
    root = findProjectByPath(projects, options.path ?? DEFAULT_PROJECT_SOURCE.path);
  }

  if (!root) {
    return { root: null, label: DEFAULT_PROJECT_SOURCE.label, categories: [], totalProjects: 0 };
  }

  const categories = pinnedFirst(
    getDirectChildren(projects, root.id).map((child) => toCategory(projects, child)),
  );
  return {
    root,
    label: root.name,
    categories,
    totalProjects: getAllDescendants(projects, root.id).length,
  };
}

/**
 * Candidate parents for the root-swapper picker: any project that has at
 * least one child. The default root is always included if present.
 */
export function getParentCandidates(projects: Project[]): Project[] {
  const parentIds = new Set<number>();
  for (const p of projects) {
    if (p.parentProjectId !== null) parentIds.add(p.parentProjectId);
  }
  return projects.filter((p) => parentIds.has(p.id));
}

/** Find a single category (direct child of a resolved root) by its slug. */
export function findCategoryBySlug(
  source: ResolvedProjectSource,
  slug: string,
): ProjectCategory | null {
  return source.categories.find((c) => c.slug === slug) ?? null;
}
