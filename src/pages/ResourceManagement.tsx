import { useEffect, useMemo, useState } from 'react';
import ReorderableSection from '../components/ReorderableSection';
import ResourceTimeline from '../components/ResourceTimeline';
import { currentMockUser } from '../data/mockData';
import { useSectionOrder } from '../hooks/useSectionOrder';
import { getIssues, getResourceAllocations, getUsers } from '../services/redmineApi';
import type { Issue, ResourceAllocation, User } from '../types/redmine';

interface Props {
  /** When set, only show that single section. Used by the legacy
   *  `/resources/personal` and `/resources/team` routes. */
  view?: 'personal' | 'team';
}

interface SectionDef {
  id: string;
  title: string;
  subtitle?: string;
  filter: (kind: { users: User[]; issues: Issue[]; allocations: ResourceAllocation[] }) => {
    users: User[];
    issues: Issue[];
    allocations: ResourceAllocation[];
  };
}

const SECTIONS: SectionDef[] = [
  {
    id: 'personal',
    title: 'Personal — my Gantt',
    subtitle: 'Your allocations across active projects.',
    filter: ({ users, issues, allocations }) => ({
      users: users.filter((u) => u.id === currentMockUser.id),
      issues: issues.filter((i) => i.assignee?.id === currentMockUser.id),
      allocations: allocations.filter((a) => a.userId === currentMockUser.id),
    }),
  },
  {
    id: 'team',
    title: 'Team — full workload',
    subtitle: 'Gantt across the whole team. Red bars indicate overload.',
    filter: (all) => all,
  },
];

const DEFAULT_ORDER = SECTIONS.map((s) => s.id);

export default function ResourceManagement({ view }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [allocations, setAllocations] = useState<ResourceAllocation[]>([]);

  const { order, moveUp, moveDown } = useSectionOrder({
    storageKey: 'rod.resources.order',
    defaultOrder: DEFAULT_ORDER,
  });

  useEffect(() => {
    (async () => {
      const [u, i, a] = await Promise.all([
        getUsers(),
        getIssues(),
        getResourceAllocations(),
      ]);
      setUsers(u);
      setIssues(i);
      setAllocations(a);
    })();
  }, []);

  const visibleSections = useMemo(() => {
    if (view) return SECTIONS.filter((s) => s.id === view);
    return order
      .map((id) => SECTIONS.find((s) => s.id === id))
      .filter((s): s is SectionDef => Boolean(s));
  }, [order, view]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Resource Management</h1>
        <p className="text-sm text-ink-muted">
          {view
            ? 'Single-view route for backward compatibility — for the full reorderable view, use the Resources sidebar entry.'
            : 'Reorderable sections — use the up/down arrows to put the view you check most often on top. Layout is saved per device.'}
        </p>
      </div>

      <div className="space-y-4">
        {visibleSections.map((section, idx) => {
          const filtered = section.filter({ users, issues, allocations });
          return (
            <ReorderableSection
              key={section.id}
              id={section.id}
              title={section.title}
              subtitle={section.subtitle}
              canMoveUp={!view && idx > 0}
              canMoveDown={!view && idx < visibleSections.length - 1}
              onMoveUp={() => moveUp(section.id)}
              onMoveDown={() => moveDown(section.id)}
            >
              <ResourceTimeline
                users={filtered.users}
                issues={filtered.issues}
                allocations={filtered.allocations}
              />
            </ReorderableSection>
          );
        })}
      </div>
    </div>
  );
}
