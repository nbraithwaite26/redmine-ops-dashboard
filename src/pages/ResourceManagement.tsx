import { useEffect, useMemo, useState } from 'react';
import ReorderableSection from '../components/ReorderableSection';
import ResourceTimeline from '../components/ResourceTimeline';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useSectionOrder } from '../hooks/useSectionOrder';
import { findProjectByPath } from '../lib/projectTree';
import { DEFAULT_PROJECT_SOURCE } from '../services/projectSource';
import { getProjects, getTeamSchedule } from '../services/redmineApi';
import type { Issue, ResourceAllocation, User } from '../types/redmine';

interface Props {
  /** When set, only show that single section. Used by the legacy
   *  `/resources/personal` and `/resources/team` routes. */
  view?: 'personal' | 'team';
}

interface FilteredData {
  users: User[];
  issues: Issue[];
  allocations: ResourceAllocation[];
}

interface SectionDef {
  id: string;
  title: string;
  subtitle?: string;
  filter: (
    kind: FilteredData,
    currentUserId: number | undefined,
  ) => FilteredData;
  render: (data: FilteredData, loading: boolean) => JSX.Element;
}

const TIMELINE_SECTIONS: SectionDef[] = [
  {
    id: 'personal',
    title: 'Personal — my Gantt',
    subtitle: 'Your allocations across active projects.',
    filter: ({ users, issues, allocations }, currentUserId) => {
      if (currentUserId === undefined) return { users, issues, allocations };
      return {
        users: users.filter((u) => u.id === currentUserId),
        issues: issues.filter((i) => i.assignee?.id === currentUserId),
        allocations: allocations.filter((a) => a.userId === currentUserId),
      };
    },
    render: (data) => (
      <ResourceTimeline
        users={data.users}
        issues={data.issues}
        allocations={data.allocations}
      />
    ),
  },
  {
    id: 'team',
    title: 'Team — full workload',
    subtitle: 'Gantt across the whole team. Red bars indicate overload.',
    filter: (all) => all,
    render: (data) => (
      <ResourceTimeline
        users={data.users}
        issues={data.issues}
        allocations={data.allocations}
      />
    ),
  },
];

const SECTIONS: SectionDef[] = TIMELINE_SECTIONS;

const DEFAULT_ORDER = SECTIONS.map((s) => s.id);

export default function ResourceManagement({ view }: Props) {
  const { user: currentUser, loading: userLoading } = useCurrentUser();
  const [users, setUsers] = useState<User[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [allocations, setAllocations] = useState<ResourceAllocation[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(true);

  const { order, moveUp, moveDown } = useSectionOrder({
    storageKey: 'rod.resources.order',
    defaultOrder: DEFAULT_ORDER,
  });

  useEffect(() => {
    if (userLoading) return;
    let cancelled = false;
    setDataLoading(true);
    // Scope the page to the AIRCRAFT ENGINEERING project tree via
    // getTeamSchedule(rootId) — same pattern as the Dashboard's Resource
    // Planning tab. This replaces three unscoped, full-org calls (getUsers,
    // getIssues, getResourceAllocations) with a single project-scoped /gantt
    // fetch that returns users + issues + allocations already trimmed to
    // the engineering tree. Users without an admin key get the same data
    // because /gantt derives the roster from issue assignees.
    (async () => {
      try {
        const projects = await getProjects();
        if (cancelled) return;
        const root = findProjectByPath(projects, DEFAULT_PROJECT_SOURCE.path);
        const schedule = await getTeamSchedule(root?.id);
        if (cancelled) return;
        setUsers(schedule.users);
        setIssues(schedule.issues);
        setAllocations(schedule.allocations);
      } catch {
        // Surface via the timeline's own empty state — no extra UI here.
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userLoading]);

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
          const filtered = section.filter({ users, issues, allocations }, currentUser?.id);
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
              {section.render(filtered, dataLoading)}
            </ReorderableSection>
          );
        })}
      </div>
    </div>
  );
}
