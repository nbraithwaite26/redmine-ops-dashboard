import { useEffect, useState } from 'react';
import ResourceTimeline from '../components/ResourceTimeline';
import { getIssues, getResourceAllocations, getUsers } from '../services/redmineApi';
import type { Issue, ResourceAllocation, User } from '../types/redmine';

export default function ResourceManagement() {
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Resource Management</h1>
        <p className="text-sm text-ink-muted">
          Gantt-style allocation view across the team. Red bars indicate overload, purple
          bars are manual allocations.
        </p>
      </div>

      <ResourceTimeline users={users} issues={issues} allocations={allocations} />
    </div>
  );
}
