# Progress

High-level snapshot of where the Redmine Ops Dashboard stands. For the
blow-by-blow, see [`CHANGE_REQUESTS.md`](./CHANGE_REQUESTS.md) (per-CR scope +
decisions), [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md) (integration
plan ledger + next-session handoff), and the root [`CHANGELOG.md`](../CHANGELOG.md).

_Last updated: 2026-05-27._

## Current state

- **Two-process app**: Vite/React frontend + Hono backend (`server/`) that
  brokers every Redmine call (API key stays server-side). Running live against
  `redmine.avionica.com` in **read-only** mode.
- **`main` is in sync with `origin/main`** — everything below is committed and
  pushed.
- **Validation (last full run):**
  - `npm run typecheck` (frontend) — pass
  - `npm --workspace server run typecheck` — pass
  - `npm run lint` — **0 warnings**
  - `npm test` — 49 files / 357 tests pass
  - `npm --workspace server run test` — 14 files / 73 tests pass
  - `npm run build` — pass

## Shipped this work stream

| Item | Summary |
| --- | --- |
| **§13 — Redis stores** | Session + rate-limit stores switch to Redis behind `REDIS_URL`; in-memory fallback when unset. |
| **CR #15 — Projects dashboard** | `/projects` rebuilt as a Home-style category dashboard (source picker + metrics + cards); `/projects/category/:slug` drill-down; "All Projects" demoted to a Projects sub-link. New `projectTree.ts` + `projectSource.ts` (isolates the `**AV Engineering / AIRCRAFT ENGINEERING` default path). `getProjects()` paginates. |
| **CR #16 — Hours group + Gantt** | "Hours" sidebar group (Time Tracking + Resource Management); `/gantt` paginates + accepts `project_id`; `getTeamSchedule()` derives users from assignees (works around degraded `/users.json`). |
| **CR #18 — Pre-live QA batch** | Responsive TopBar (0 horizontal overflow at 390/1280/1920); Hours roster from assignees; select-first hierarchical `UserGantt`; `TeamHours` Card/List views; sidebar Tasks→Past Due / Projects→Project Builder / +Reports; AllProjects HTML strip; TimeTracking de-mock; Hours auto-refresh; STCs `stc→stcs` alias; lint 0 warnings; category/loading polish. |
| **CR #17 — Real Dashboard tabs** | The four Overview tabs render distinct content (was: `tab` set but never read). Persistent metric grid; *Project Health* = AIRCRAFT ENGINEERING tree (`DashboardProjectHealth`, shared `lib/projectHealth.ts`); *Resource Planning* = embedded team Gantt (`DashboardResourcePlanning`). |
| **CR #19 — Team's Work redesign** | Team-scoped metric cards (`buildTeamMetrics`); per-engineer cards with projects (`TeamWorkPanel`); persisted engineer selector (`TeamMemberSelector`); iOS card→full-screen-detail morph (`TeamMemberCard`/`TeamMemberDetail`) via Framer Motion shared `layoutId`. Added `framer-motion`. |

## Known live-data gotchas (carry forward)

- The default project root is literally named **`**AV Engineering`** (the `**`
  is part of the name) → `AIRCRAFT ENGINEERING` (id 127). Isolated in
  `services/projectSource.ts`.
- Live **`/users.json` 403s** for the non-admin API key (returns 0 users).
  Anything needing a roster derives it from issue assignees instead.
- Many real issues lack start/due dates, so Gantt bars are sparse; project
  list and the gantt route both paginate.

## Open / next

- **Section 15 — live-Redmine write validation**. Flip
  `REDMINE_READ_ONLY=false` in `.env.local`, restart the backend, smoke every
  mutation path. Real writes — only when ready.

## Run it

```bash
npm install
npm run dev:all          # frontend :5174 + backend :8787
# or separately:
npm --workspace server run start
npm run dev
```

Secrets live in `.env.local` (gitignored, untracked). Mock mode:
`VITE_MOCK_MODE=true`.
