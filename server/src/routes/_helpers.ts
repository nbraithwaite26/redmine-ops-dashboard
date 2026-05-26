import { z } from 'zod';

/**
 * Common pagination params. Redmine's max limit is 100; we cap at that.
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Builds the wire-shape paginated response from a Redmine listing.
 */
export interface PaginatedSource<T> {
  items: T[];
  totalCount: number;
  limit: number;
  offset: number;
}

export function paginated<T>(source: PaginatedSource<T>) {
  return {
    items: source.items,
    total: source.totalCount,
    limit: source.limit,
    offset: source.offset,
  };
}

/**
 * Filters out undefined/null query params and returns a Record<string,
 * string | number>. Only allowlisted keys are passed; everything else is
 * dropped silently to avoid accidental forwarding.
 */
export function passthroughQuery(
  raw: Record<string, string | undefined>,
  allowed: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of allowed) {
    const v = raw[key];
    if (v !== undefined && v !== '') out[key] = v;
  }
  return out;
}
