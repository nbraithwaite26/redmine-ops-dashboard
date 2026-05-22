import { useEffect, useState } from 'react';
import ResourceTimeline from '../components/ResourceTimeline';
import { currentMockUser } from '../data/mockData';
import { getIssues, getResourceAllocations, getUsers } from '../services/redmineApi';
import type { Issue, ResourceAllocation, User } from '../types/redmine';

interface Props {
  /**
   * Which slice of the timeline to show.
   * - `personal`: filter to the current user.
   * - `team`:     full team view (current default).
   *
   * The full reorderable multi-section page lands in CR #3+#4. This prop is
   * the seam that change request will plug into.
   */
  view?: 'personal' | 'team';
}

export default function ResourceManagement({ view = 'team' }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [allocations, setAllocations] = useState<ResourceAllocation[]>([]);

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

  const isPersonal = view === 'personal';

  const filteredUsers = isPersonal
    ? users.filter((u) => u.id === currentMockUser.id)
    : users;
  const filteredIssues = isPersonal
    ? issues.filter((i) => i.assignee?.id === currentMockUser.id)
    : issues;
  const filteredAllocations = isPersonal
    ? allocations.filter((a) => a.userId === currentMockUser.id)
    : allocations;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">
          {isPersonal ? 'Resource Planning · Personal' : 'Resource Planning · Team'}
        </h1>
        <p className="text-sm text-ink-muted">
          {isPersonal
            ? 'Your allocations across active projects. Red bars indicate overload.'
            : 'Gantt-style allocation view across the team. Red bars indicate overload, purple bars are manual allocations.'}
        </p>
      </div>

      <ResourceTimeline
        users={filteredUsers}
        issues={filteredIssues}
        allocations={filteredAllocations}
      />
    </div>
  );
}
