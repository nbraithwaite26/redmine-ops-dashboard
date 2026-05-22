import { useEffect, useState } from 'react';
import CalendarGrid from '../components/CalendarGrid';
import { getIssues } from '../services/redmineApi';
import type { Issue } from '../types/redmine';

export default function Calendar() {
  const [issues, setIssues] = useState<Issue[]>([]);

  useEffect(() => {
    (async () => setIssues(await getIssues()))();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="text-sm text-ink-muted">
          Issues placed on their due date. Red blocks are overdue, dots show priority.
        </p>
      </div>
      <CalendarGrid issues={issues} />
    </div>
  );
}
