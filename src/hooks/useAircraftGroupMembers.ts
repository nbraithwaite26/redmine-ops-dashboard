import { useEffect, useState } from 'react';
import { getGroup } from '../services/redmineApi';

/** Redmine group id for the "(eng) Aircraft" team. */
export const AIRCRAFT_GROUP_ID = 122;

interface State {
  /** Set of user ids in the (eng) Aircraft group, or null until the fetch resolves. */
  memberIds: Set<number> | null;
  /** Convenience: memberIds.size, or 0 while still loading / on failure. */
  count: number;
}

/**
 * Module-level promise so concurrent consumers share one fetch and one parse,
 * and the result lives for the life of the tab (the membership list rarely
 * changes mid-session and the server adapter already caches).
 *
 * Reset to null on test setup if you need a fresh fetch; otherwise leave it.
 */
let cached: Promise<Set<number>> | null = null;

function fetchMemberIds(): Promise<Set<number>> {
  if (cached) return cached;
  cached = getGroup(AIRCRAFT_GROUP_ID)
    .then((g) => new Set(g.members.map((u) => u.id)))
    .catch(() => {
      // On error, drop the cache so the next mount can retry rather than
      // permanently sticking on the empty set.
      cached = null;
      return new Set<number>();
    });
  return cached;
}

/**
 * Returns the (eng) Aircraft group member ids. Used to scope dashboard
 * metrics — e.g. the Engineers Out card — to the engineering team regardless
 * of the user's per-workspace team picker selection.
 */
export function useAircraftGroupMembers(): State {
  const [memberIds, setMemberIds] = useState<Set<number> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMemberIds().then((ids) => {
      if (!cancelled) setMemberIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { memberIds, count: memberIds?.size ?? 0 };
}

/**
 * Test-only escape hatch. Vitest can call this between tests to force a fresh
 * fetch (e.g. after re-mocking `getGroup`).
 */
export function __resetAircraftGroupCache(): void {
  cached = null;
}
