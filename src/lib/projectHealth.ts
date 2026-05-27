import { getAllDescendants } from './projectTree';
import type { DashboardMetric, Project } from '../types/redmine';

export const safePercent = (value: number, total: number): number => {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
};

/**
 * Headline metrics for a project source: total / active / at-risk projects
 * under `rootId`, plus the direct-category count. Shared by the Projects page
 * and the Dashboard "Project Health" tab (CR #17).
 */
export function buildSourceMetrics(
  projects: Project[],
  rootId: number,
  totalProjects: number,
  categoryCount: number,
): DashboardMetric[] {
  const descendants = getAllDescendants(projects, rootId);
  const active = descendants.filter((p) => p.status === 'Active').length;
  const atRisk = descendants.filter((p) => p.status === 'At Risk').length;
  return [
    {
      id: 'total-projects',
      title: 'Total projects',
      value: totalProjects,
      progress: 100,
      color: '#3B82F6',
      caption: 'across all subprojects',
    },
    {
      id: 'active-projects',
      title: 'Active',
      value: active,
      total: totalProjects,
      progress: safePercent(active, totalProjects),
      statusLabel: 'Active',
      statusColor: 'green',
      color: '#10B981',
    },
    {
      id: 'at-risk-projects',
      title: 'At risk',
      value: atRisk,
      total: totalProjects,
      progress: safePercent(atRisk, totalProjects),
      statusLabel: atRisk > 0 ? 'Needs attention' : 'All clear',
      statusColor: atRisk > 0 ? 'red' : 'gray',
      color: '#EF4444',
    },
    {
      id: 'categories',
      title: 'Categories',
      value: categoryCount,
      progress: 100,
      color: '#8B5CF6',
      caption: 'direct sections',
    },
  ];
}
