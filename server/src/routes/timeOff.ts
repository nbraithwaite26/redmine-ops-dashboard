import { Hono } from 'hono';
import { z } from 'zod';
import { redmineFetch } from '../redmineClient.js';
import { adaptEasyAttendanceAsTimeOff } from '../adapters/timeOff.js';
import { keyFromParts } from '../cache.js';
import type { EasyAttendanceDto } from '../types/redmineDto.js';
import type { NormalizedTimeOffEntry } from '../types/normalized.js';
import type { AppEnv } from '../types/appVars.js';

/**
 * Out-of-office route. Sourced from Easy Redmine's
 * /easy_attendances.json — engineers log Vacation/Holiday/Sick days there
 * and the activity carries an `at_work` boolean. We surface only the rows
 * where at_work=false within the requested date window.
 *
 * Upstream gotcha: the Easy Query filter syntax (set_filter=1 + f[]/op/v
 * params) is silently ignored on /easy_attendances.json — we tried `arrival`,
 * `date`, `arrival_date`, `easy_attendance_activity_at_work`, plus a few
 * shorthand params (from/to, arrival_from/arrival_to, period). None apply.
 * What DOES work is `set_filter=1` alone to broaden scope from "my entries"
 * to org-wide; the response is then sorted by `arrival` descending. So we
 * page from offset 0 and bail out as soon as a page's first row pre-dates
 * range.from. For a typical 1-week window that's 1–5 pages of 100.
 *
 * If the page cap is hit (PAGE_CAP_HIT) we return whatever we collected — a
 * truncation header isn't worth the complexity for a card metric, and the
 * cap is generous (4000 rows) relative to org headcount × days.
 */

const timeOff = new Hono<AppEnv>();

const PAGE_SIZE = 100;
const MAX_PAGES = 40; // 40 × 100 = 4000 rows — covers months even on a busy team.
const TTL_MS = 60_000; // 1 min: card refreshes when the week selector moves.
const STALE_MS = 10 * 60_000;

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

timeOff.get('/', async (c) => {
  const requestId = c.get('requestId');
  let parsed: { from: string; to: string };
  try {
    parsed = querySchema.parse(c.req.query());
  } catch (err) {
    return c.json(
      {
        error: {
          code: 'BAD_REQUEST',
          message:
            err instanceof z.ZodError
              ? `Invalid range params: ${err.issues[0]?.message ?? 'unknown'}`
              : 'Invalid range params.',
          requestId,
        },
      },
      400,
    );
  }
  const { from, to } = parsed;
  if (from > to) {
    return c.json(
      { error: { code: 'BAD_REQUEST', message: '`from` must be <= `to`.', requestId } },
      400,
    );
  }

  const items: NormalizedTimeOffEntry[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE;
    const raw = await redmineFetch<{
      easy_attendances: EasyAttendanceDto[];
      total_count: number;
      offset: number;
      limit: number;
    }>('/easy_attendances.json', {
      query: { set_filter: 1, limit: PAGE_SIZE, offset },
      cache: {
        // Per-page cache so the warmer / reloads share cost across users.
        key: keyFromParts('time-off:page', { offset, limit: PAGE_SIZE }),
        ttlMs: TTL_MS,
        staleMs: STALE_MS,
      },
    });

    const rows = raw.easy_attendances ?? [];
    if (rows.length === 0) break;

    let pagePastWindow = true;
    for (const row of rows) {
      const date = row.arrival?.slice(0, 10);
      if (!date) continue;
      if (date < from) continue; // past the window (sorted desc, so older)
      pagePastWindow = false;
      if (date > to) continue; // future of the window
      const mapped = adaptEasyAttendanceAsTimeOff(row);
      if (mapped) items.push(mapped);
    }
    // The list is sorted by arrival desc. Once a full page's rows all
    // pre-date `from`, every subsequent page will too — stop paging.
    const last = rows[rows.length - 1];
    if (pagePastWindow && last && last.arrival.slice(0, 10) < from) {
      break;
    }
    // Also stop if the upstream tells us we've drained the list.
    if (offset + rows.length >= raw.total_count) break;
  }

  return c.json({ items });
});

export default timeOff;
