# Project Notes

Keep this file under 100-300 lines total. If it grows beyond that, summarize, delete stale details, or move history to an archive doc.

## Purpose
Internal ops dashboard over Redmine — engineer workload, time entries, time-off, Gantt — for the team at this Redmine instance.

## Current Architecture
- Frontend: Vite + React 18 + TS + Tailwind in `src/`. Pages in `src/pages`, components in `src/components`.
- Backend: Hono server in `server/` (npm workspace). Acts as a proxy that injects `X-Redmine-API-Key` — the browser must NEVER call Redmine REST directly.
- API facade: `src/services/redmineApi.ts` picks `mockRedmineApi` vs `realRedmineApi` at load time based on `VITE_MOCK_MODE` (default `true`). Call sites import named functions, not the object.
- Server adapters in `server/src/adapters/*` normalize Redmine DTOs (`types/redmineDto.ts`) into shared shapes (`types/normalized.ts`); routes in `server/src/routes/*` are thin.
- List endpoints paginate; the warmer walks all pages with SWR semantics. Don't cap at the first page.
- Session via `middleware/session.ts` + Redis store. Writes gated by `middleware/readOnly.ts`.

## Commands
- Dev (both): `npm run dev:all`  · web only: `npm run dev`  · api only: `npm run dev:server`
- Test: `npm test`  · server tests: `npm run test:server`
- Typecheck: `npm run typecheck`  · Lint: `npm run lint`  · Build: `npm run build`

## Conventions
- Runtime mode is live + writable per user memory — don't auto-revert to mock or read-only.
- New Redmine endpoints: add adapter in `server/src/adapters`, route in `server/src/routes`, then expose through the facade in `src/services/redmineApi.ts`. Don't fetch Redmine directly from components.
- Team scoping: anything that says "your team" must scope to the user's selected team via `src/lib/teamSelection.ts` + `src/hooks/useSelectedTeam.ts`, not the full roster. Default team is the 12-engineer set defined there.
- Live Redmine returns assignees as email local-parts (the non-admin key can't read `/users`), so match by login too, not just first name.
- Tests are Vitest + Testing Library, colocated under `src/tests/` and `server/src/**/__tests__`. No Playwright yet.
- TS strict — keep `tsc --noEmit` clean before committing.
- Commit on feature branches (`feat/<name>`), not `main`. Short imperative summaries.

## Current Task Context
- Adopting Adrian-style workflow: project CLAUDE.md (this file) + per-feature branches + thin docs.
- Open in working tree: time-off feature (`server/src/{adapters,routes}/timeOff.ts`, `TimeOffDetail.tsx`), groups feature (`server/src/{adapters,routes}/group{,s}.ts`), engineering-order util (`src/lib/engineeringOrder.ts`), new hooks (`useSelectedTeam`, `useWorkspace`).
- Known quirk: warmer used to burn the user's rate-limit quota; recently fixed (commit 503e91a) — keep warmer requests bounded.

## Do Not Include
- Full logs
- Full file contents
- Old decisions
- Repeated explanations
