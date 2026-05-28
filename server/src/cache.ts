/**
 * In-memory TTL cache for server-side Redmine reads (CR #29).
 *
 * Supports:
 *  - TTL get-or-fetch with optional stale-while-revalidate window
 *  - In-flight coalescing — concurrent misses share a single upstream call
 *  - Bounded LRU eviction (touch-on-hit; oldest dropped at capacity)
 *  - Prefix-scoped invalidation (called from write routes)
 *  - Per-entry size guard (payloads over `maxBytesPerEntry` are not stored)
 *
 * Single-process Map; Phase D will move this to Redis behind the same API.
 * Never logs keys or payloads — keys can encode filter values that mirror
 * user queries.
 */

export interface CacheGetOptions {
  /** If set, an expired entry within `staleMs` past TTL is returned and a
   *  background refresh is scheduled. Defaults to 0 (no SWR). */
  staleMs?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  staleHits: number;
  coalesced: number;
  evictions: number;
  rejectedTooLarge: number;
  size: number;
}

interface Entry<T> {
  data: T;
  fetchedAt: number;
  bytes: number;
}

const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_MAX_BYTES_PER_ENTRY = 1_000_000;

const entries = new Map<string, Entry<unknown>>();
const pending = new Map<string, Promise<unknown>>();

let counters = freshCounters();
let maxEntries = DEFAULT_MAX_ENTRIES;
let maxBytesPerEntry = DEFAULT_MAX_BYTES_PER_ENTRY;

function freshCounters(): Omit<CacheStats, 'size'> {
  return {
    hits: 0,
    misses: 0,
    staleHits: 0,
    coalesced: 0,
    evictions: 0,
    rejectedTooLarge: 0,
  };
}

export function getCacheStats(): CacheStats {
  return { ...counters, size: entries.size };
}

export function resetCache(): void {
  entries.clear();
  pending.clear();
  counters = freshCounters();
}

export function configureCache(opts: {
  maxEntries?: number;
  maxBytesPerEntry?: number;
}): void {
  if (opts.maxEntries !== undefined) maxEntries = opts.maxEntries;
  if (opts.maxBytesPerEntry !== undefined) maxBytesPerEntry = opts.maxBytesPerEntry;
}

/**
 * Builds a stable cache key from a prefix + an optional parameter map.
 * Keys are deterministic regardless of insertion order, and empty/undefined
 * values are dropped. Examples:
 *   keyFromParts('issues:list', { project_id: '127' }) → 'issues:list:project_id=127'
 *   keyFromParts('me:current')                          → 'me:current'
 */
export function keyFromParts(
  prefix: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  if (!params) return prefix;
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  return parts.length ? `${prefix}:${parts.join('&')}` : prefix;
}

/**
 * Drop cache entries. With no argument, clears everything. With a prefix,
 * drops keys starting with it. A trailing `*` is tolerated:
 * `invalidate('issues:*')` and `invalidate('issues:')` behave the same.
 * Returns the number of entries removed.
 */
export function invalidate(prefix?: string): number {
  if (prefix === undefined || prefix === '*') {
    const n = entries.size;
    entries.clear();
    return n;
  }
  const normalized = prefix.endsWith('*') ? prefix.slice(0, -1) : prefix;
  let removed = 0;
  for (const key of entries.keys()) {
    if (key.startsWith(normalized)) {
      entries.delete(key);
      removed += 1;
    }
  }
  return removed;
}

function evictIfNeeded(): void {
  while (entries.size > maxEntries) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
    counters.evictions += 1;
  }
}

function storeEntry<T>(key: string, data: T): void {
  let bytes: number;
  try {
    bytes = JSON.stringify(data).length;
  } catch {
    counters.rejectedTooLarge += 1;
    return;
  }
  if (bytes > maxBytesPerEntry) {
    counters.rejectedTooLarge += 1;
    return;
  }
  entries.delete(key);
  entries.set(key, { data, fetchedAt: Date.now(), bytes });
  evictIfNeeded();
}

/**
 * Returns cached data if fresh; coalesces concurrent misses; serves stale
 * data + background-refreshes when `staleMs` is set.
 */
export async function getOrFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  opts: CacheGetOptions = {},
): Promise<T> {
  const now = Date.now();
  const entry = entries.get(key) as Entry<T> | undefined;
  const staleMs = opts.staleMs ?? 0;

  if (entry) {
    const age = now - entry.fetchedAt;
    if (age < ttlMs) {
      counters.hits += 1;
      entries.delete(key);
      entries.set(key, entry);
      return entry.data;
    }
    if (age < ttlMs + staleMs) {
      counters.staleHits += 1;
      if (!pending.has(key)) {
        const refresh = fetcher()
          .then((data) => {
            storeEntry(key, data);
            return data;
          })
          .catch(() => entry.data)
          .finally(() => {
            pending.delete(key);
          });
        pending.set(key, refresh);
      }
      return entry.data;
    }
  }

  const inFlight = pending.get(key) as Promise<T> | undefined;
  if (inFlight) {
    counters.coalesced += 1;
    return inFlight;
  }

  counters.misses += 1;
  const promise = fetcher()
    .then((data) => {
      storeEntry(key, data);
      return data;
    })
    .finally(() => {
      pending.delete(key);
    });
  pending.set(key, promise);
  return promise;
}
