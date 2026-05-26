# Redmine Operations Dashboard — Backend / API Integration Plan

Status: **proposed (not yet implemented) — revised**
Scope: backend proxy + frontend wiring to take the dashboard from mock-only to live Redmine, without breaking mock mode, while keeping the API key off the browser.

This document is the authoritative implementation plan referred to in the task brief. It is meant to be read end-to-end before any code lands.

---

## 1. Guardrails (apply to every step below)

- **No company data in the repo.** Mock fixtures stay anonymized. No real subjects, descriptions, customer names, internal URLs, or user emails enter `src/data/**`, `src/tests/**`, `server/test/fixtures/**`, or any committed file.
- **No hardcoded API keys.** Keys are loaded from server-side env only — never from `import.meta.env`, never bundled.
- **No browser → Redmine direct calls.** The browser only ever talks to our own backend (`/api/redmine/*`). The backend injects `X-Redmine-API-Key` server-side.
- **`.env.local` is gitignored** (verified — see [.gitignore:19](../.gitignore)) and must stay that way. `.env.example` is the only env file committed.
- **Read-only first.** `REDMINE_READ_ONLY=true` is the default; the backend rejects every non-GET request with 403 while it is set. Write routes ship behind explicit UI actions and require an operator to flip the flag.
- **Mock mode preserved.** `VITE_MOCK_MODE=true` continues to short-circuit the facade and never touches the network — useful for local demos and CI.
- **Brand & UX unchanged.** `#FEDF00`, the existing AppShell, and all current routes in [src/App.tsx](../src/App.tsx) stay identical. This work is plumbing, not redesign.

---

## 2. Architecture

```
┌──────────────┐      ┌──────────────────────┐      ┌──────────────────┐
│  React UI    │ ───► │  Backend proxy       │ ───► │  Redmine REST    │
│  (existing)  │      │  /api/redmine/*      │      │  (corp instance) │
│              │      │  injects X-Redmine-  │      │                  │
│              │      │  API-Key             │      │                  │
└──────────────┘      └──────────────────────┘      └──────────────────┘
       │
       │  facade unchanged
       ▼
src/services/redmineApi.ts  ──► mockRedmineApi | realRedmineApi (HTTP)
```

Three layers; each owns one concern.

| Layer | Lives in | Responsibility |
| --- | --- | --- |
| **UI** | `src/pages/**`, `src/components/**` | Calls named exports from `services/redmineApi.ts`. No URL knowledge. |
| **Facade** | `src/services/redmineApi.ts` + `realRedmineApi.ts` + `mockRedmineApi.ts` | Picks impl by `VITE_MOCK_MODE`. Stable contract from [redmineApiTypes.ts](../src/services/redmineApiTypes.ts). |
| **Backend** | new `server/` directory | Holds the API key, talks to Redmine, normalizes responses, enforces read-only mode and rate-limits. |

### Why a backend (not a Vite proxy)

A Vite dev `server.proxy` would work in dev but the production build is a static `dist/` deployed to GitHub Pages. Pages can't inject headers, so we need a real server process. Choose **Node + Hono** (small, TS-native, fetch-shaped, runs identically in dev and prod). Alternatives considered:

- **Express** — fine, but heavier and uses callback-style by default. Not preferred for a fresh proxy.
- **Next.js API routes** — overkill; would force the frontend into Next.
- **Vercel/Netlify functions** — fine for hosting later, but Hono runs on those runtimes too, so we don't lock in.

Decision: ship `server/` as a standalone Hono app on Node 20. It can be deployed standalone (Render / Fly / a VM) or as serverless functions — same handlers either way.

---

## 3. Environment / config

`.env.local` (already gitignored) holds **server-side** vars:

```
REDMINE_BASE_URL=https://redmine.yourdomain.tld
REDMINE_API_KEY=<the-actual-key>
REDMINE_READ_ONLY=true          # flip to false only when write actions are vetted
PORT=8787                       # backend listen port
ALLOWED_ORIGIN=http://localhost:5173
LOG_LEVEL=info
```

Frontend env (Vite reads only `VITE_*` and bundles them — anything secret must NOT have that prefix):

```
VITE_MOCK_MODE=true             # default; flip to false to hit the backend
VITE_API_BASE=/api/redmine      # what realRedmineApi.ts fetches against
```

- `.env.example` will be updated with both halves and **no real values**.
- The backend reads `process.env.*` at startup, fails fast if `REDMINE_BASE_URL` or `REDMINE_API_KEY` are missing in non-mock mode.
- We do **not** rename or re-purpose `VITE_REDMINE_API_KEY` from the current `.env.example` — we delete that line, because shipping an API key with a `VITE_` prefix is exactly the leak we're preventing.
- Local development runs the frontend on `http://localhost:5173` and the backend on `http://localhost:8787`. The frontend calls `/api/redmine/*`; Vite `server.proxy` forwards `/api` to the backend. Production static hosting points `VITE_API_BASE` at the deployed backend URL.

---

## 4. Phase 0 - Preflight (must complete before any backend work)

These items are blockers for the rest of the plan. They do not deliver Redmine integration; they make sure the integration work can be validated.

### 4.1 Vitest / Vite config preflight on Windows

**Background.** `npm test` and `npm run build` have both failed in this Windows environment because Vite/Vitest/esbuild could not load the Vite config (`vite.config.ts` for tests, `vite.config.js` for build). The likely causes are environmental config loading plus generated shadow files (`vite.config.js` / `vite.config.d.ts`) sitting beside the source config. Those generated files may exist locally even though only `vite.config.ts` is tracked by Git.

**Why this matters.** Tests are the only mechanical proof that the facade contract still holds when we replace stubs with HTTP. If they don't run, we ship blind.

**Resolution path (do this first; do not skip tests):**

1. **Reproduce the failure** on a clean dependency install:
   - Delete `node_modules` only.
   - Run `npm ci` when `package-lock.json` is present. Use `npm install` only if the lockfile must be regenerated because dependency declarations changed.
   - Run `npm test`.
   - Run `npm run build`.
2. **If it fails with the esbuild / Vite config symptom**, apply the fixes in this order, stopping when tests and build both pass:
   1. Delete generated local shadow files `vite.config.d.ts` and `vite.config.js` so only `vite.config.ts` remains. They are byproducts of a stray `tsc` emit and should remain ignored. Verify with `git ls-files vite.config.*`; only `vite.config.ts` should be tracked.
   2. Pin esbuild to a Windows-known-good version via `npm install --save-dev esbuild@<version-matched-to-vite>`; let `vite` resolve the matching `@esbuild/win32-x64` optionalDependency.
   3. Reinstall: `npm rebuild esbuild` or delete `node_modules` and run `npm ci`.
   4. As a last resort, move the test runtime config out of `vite.config.ts` into a dedicated `vitest.config.ts` so the test path no longer depends on the Vite build config loader. Keep the same `test:` block contents.
3. **Add a CI smoke job** that runs `npm test -- --reporter=verbose` on `windows-latest` in `.github/workflows/ci.yml` so this regression cannot land silently again.

**Acceptance for Phase 0.1.** `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` all succeed on a clean Windows checkout with no manual steps beyond `npm ci` / `npm install`.

> **Current status at time of writing:** `typecheck` and `lint` pass, but `npm test` and `npm run build` currently fail with the Vite/Vitest config loading issue (see Section 13). Phase 0 is therefore an active blocker, not only preventive work.

### 4.2 Workspace bootstrap

Add the `server/` workspace skeleton — `package.json` `workspaces` array, empty `server/package.json`, `server/tsconfig.json` — without yet adding any routes. This is so Phase 1 backend work doesn't have to relitigate workspace plumbing while it's also writing routes.

---

## 5. Backend (`server/`) — file layout

```
server/
  package.json              # separate workspace; depends on hono, zod, undici
  tsconfig.json
  vitest.config.ts          # owns its own test config — does NOT depend on root vite.config.ts
  src/
    index.ts                # bootstraps Hono, mounts routes, starts listener
    config.ts               # env loader + validation (zod); throws on missing
    redmineClient.ts        # typed wrapper around fetch → Redmine REST
    middleware/
      readOnly.ts           # blocks non-GET when REDMINE_READ_ONLY=true
      errorHandler.ts       # uniform JSON error shape
      requestId.ts          # adds X-Request-Id for log correlation
      rateLimit.ts          # token bucket per IP (single-process); see §6 Notes
    routes/
      me.ts                 # GET /api/redmine/me
      users.ts              # GET /api/redmine/users
      projects.ts           # GET projects, GET project detail, GET project members
      issues.ts             # GET list/detail, POST, PATCH, DELETE, comments, subtasks, parent
      timeEntries.ts        # GET, POST
      metadata.ts           # GET /metadata (statuses, trackers, priorities, activities, customFields-from-samples)
      gantt.ts              # GET /gantt — derived from issues
    adapters/
      issue.ts              # raw Redmine issue DTO (snake_case) → normalized Issue (camelCase)
      project.ts            # raw project DTO → normalized Project
      user.ts               # raw user DTO → normalized User
      timeEntry.ts          # raw time-entry DTO → normalized TimeEntry
      gantt.ts              # builds Gantt rows from normalized issues + relations
    types/
      redmineDto.ts         # raw Redmine response shapes (snake_case, mirrors REST)
      normalized.ts         # camelCase shapes the wire sends to the browser
                            # (re-exports/aligns with src/types/redmine.ts)
  test/
    fixtures/               # anonymized Redmine-shaped JSON
    routes.me.test.ts
    routes.users.test.ts
    routes.projects.test.ts
    routes.projectMembers.test.ts
    routes.issues.test.ts
    routes.issues.write.test.ts
    routes.timeEntries.test.ts
    routes.metadata.test.ts
    routes.gantt.test.ts
    adapters.issue.test.ts
    adapters.project.test.ts
    adapters.gantt.test.ts
    middleware.readOnly.test.ts
```

`server/` is a **separate npm workspace** so the frontend Vite build does not pull Hono into the browser bundle. Root `package.json` gains a `workspaces` array and dev scripts (`npm run dev:server`, `npm run dev:all`).

**Type-naming convention enforced across the file layout:**

- Files under `server/src/types/redmineDto.ts` use **snake_case** field names matching the Redmine REST payload (`start_date`, `due_date`, `estimated_hours`, `done_ratio`, `parent_issue_id`, `custom_fields`, `enabled_modules`).
- Files under `server/src/types/normalized.ts` and the existing [src/types/redmine.ts](../src/types/redmine.ts) use **camelCase** (`startDate`, `dueDate`, `estimatedHours`, `doneRatio`, `parentIssueId`, `customFields`, `enabledModules`).
- Adapters are the only place where the snake → camel translation happens. Nothing in `src/` ever sees snake_case Redmine field names.

---

## 6. Backend routes (contract)

All routes return JSON. Errors use:

```json
{ "error": { "code": "REDMINE_403", "message": "...", "requestId": "..." } }
```

| Method | Path | Purpose | Redmine endpoint |
| --- | --- | --- | --- |
| GET | `/api/redmine/me` | Current user | `GET /users/current.json` |
| GET | `/api/redmine/users` | List users (filters: status, name, group). Backs the frontend `getUsers()`. | `GET /users.json?limit=100` |
| GET | `/api/redmine/projects` | List projects. **No `include=` params here** — see §6 Notes. | `GET /projects.json?limit=100` |
| GET | `/api/redmine/projects/:id` | Project detail incl. `enabled_modules`, `trackers`, `issue_categories` | `GET /projects/:id.json?include=enabled_modules,trackers,issue_categories` |
| GET | `/api/redmine/projects/:id/members` | Project members. Backs the frontend `getProjectMembers(projectId)`. | `GET /projects/:id/memberships.json` |
| GET | `/api/redmine/memberships` *(optional)* | Direct passthrough for Redmine / Easy Redmine memberships if the project-scoped form turns out insufficient. Implemented only if needed during Phase 3. | `GET /memberships.json` |
| GET | `/api/redmine/issues` | List issues w/ filters (query, project, assignee, status, due range, limit/offset) | `GET /issues.json` |
| GET | `/api/redmine/issues/:id` | Single issue w/ children, relations, journals, attachments | `GET /issues/:id.json?include=children,relations,journals,attachments` |
| POST | `/api/redmine/issues` | Create issue (write-gated) | `POST /issues.json` |
| PATCH | `/api/redmine/issues/:id` | Update issue (write-gated) | `PUT /issues/:id.json` |
| DELETE | `/api/redmine/issues/:id` | Delete issue (write-gated) | `DELETE /issues/:id.json` |
| POST | `/api/redmine/issues/:id/comments` | Add note (write-gated) | `PUT /issues/:id.json` with `notes` |
| POST | `/api/redmine/issues/:id/subtasks` | Create child issue (write-gated) | `POST /issues.json` with `parent_issue_id` |
| PUT | `/api/redmine/issues/:id/parent` | Reparent (write-gated) | `PUT /issues/:id.json` with `parent_issue_id` |
| GET | `/api/redmine/time-entries` | List time entries (filters: user, project, issue, date range) | `GET /time_entries.json` |
| POST | `/api/redmine/time-entries` | Create entry (write-gated) | `POST /time_entries.json` |
| GET | `/api/redmine/metadata` | Bundles statuses + trackers + priorities + time activities + a derived custom-fields catalog (see §6 Notes). Reduces round-trips for the UI. | 4× metadata endpoints + derived custom-field aggregation |
| GET | `/api/redmine/gantt` | Derived: returns Gantt rows for a project or assignee set. Server-side because the derivation pulls issues + relations together. | `GET /issues.json?include=relations&limit=100` (paginated) |

### Notes / decisions

- **Project list `include=` is intentionally minimal.** Discovery verified that `enabled_modules`, `trackers`, and `issue_categories` work on the **detail** endpoint (`GET /projects/:id.json`). Those include params have **not** been verified on the **list** endpoint and Redmine versions differ on whether they're honored there. The safer contract is:
  - `/api/redmine/projects` returns plain project rows.
  - The UI calls `/api/redmine/projects/:id` when it actually needs enabled modules, trackers, or categories (Project detail page, ProjectBuilder, gating "Time Tracking" / "Easy Gantt Resources" features in the UI).
  - If a future need pushes us toward eager-loading those, we'll add them to the list endpoint **only after** verifying against the live instance.
- **Custom fields in real mode.** `GET /custom_fields.json` is admin-only and returned **403** on this Redmine instance. The frontend `getCustomFields(): Promise<string[]>` therefore behaves like this in real mode:
  1. **Never** call `/custom_fields.json` directly.
  2. The backend builds a derived catalog inside `/api/redmine/metadata` by harvesting `custom_fields[].name` from a small sample of recent issues (`GET /issues.json?limit=25&include=...`) and the per-project custom-field list returned by `/projects/:id.json` when the UI has already loaded a project. Names are deduplicated.
  3. If the harvest finds nothing (fresh instance, no permission to read issues with custom_fields, etc.), the backend returns `{ customFields: [] }`. The frontend treats `[]` as "no catalog available" and the UI degrades to showing whatever custom fields appear on each individual issue's payload (which is allowed by Redmine even when the global endpoint is forbidden).
  4. Per-issue custom field values are still rendered: `/api/redmine/issues/:id` passes `custom_fields` through as opaque `{ id, name, value }` records, normalized to camelCase on the wire.
  This contract is documented so the UI never assumes "the catalog is authoritative" — it isn't. Treat it as a hint, not a schema.
- **Pagination.** List endpoints accept `limit` and `offset`, default `limit=100`, cap at `100` (Redmine's max). Responses include `{ total, limit, offset, items }`.
- **Read-only middleware.** Returns 403 with `{ error: { code: "READ_ONLY" } }` for non-GET when `REDMINE_READ_ONLY=true`. Applied as a single middleware on the `/api/redmine` group.
- **Rate limiting.** Process-local token bucket (20 req/sec per IP) is the **default** and is acceptable for a single-process Node deployment. It is **not** reliable across serverless instances or horizontally-scaled replicas because each process keeps its own counter. For production beyond a single node:
  - Use a shared store (Redis is the obvious pick; Upstash/Vercel KV/Cloudflare KV work on serverless).
  - Implement against a small `RateLimitStore` interface so the in-memory and Redis adapters are swappable via env (`RATE_LIMIT_BACKEND=memory|redis`, `REDIS_URL=...`).
  - Document the limit and the backend in the operations README.
  The in-memory implementation ships first; the Redis adapter ships when the deployment target is decided.
- **Request body validation.** PATCH/POST bodies are validated with `zod` and only allowlisted fields reach Redmine. This protects us from a UI bug accidentally PATCHing `is_admin`.
- **Logging.** Each request gets an `X-Request-Id`; we log method, path, status, latency, and (on error) Redmine status code. No bodies are logged. Acceptance tests must verify logs do not include API keys, request bodies, issue subjects, descriptions, comments, customer names, or user emails.

---

## 7. Frontend changes

### 7.1 Stable facade

[src/services/redmineApi.ts](../src/services/redmineApi.ts) keeps its current named exports and `VITE_MOCK_MODE` switch. Call sites in `src/pages/**` and most of `src/components/**` do not need to change *signatures*. The component-side write flows do need code changes — see §7.7.

### 7.2 `realRedmineApi.ts` becomes the HTTP client

Each method becomes a `fetch(\`${API_BASE}/...\`)` against the backend. Shape:

```ts
async function get<T>(path: string, init?: RequestInit): Promise<T> { ... }
async function send<T>(method, path, body): Promise<T> { ... }
```

Implements the full `RedmineApi` interface from [redmineApiTypes.ts](../src/services/redmineApiTypes.ts), including `getUsers()` and `getProjectMembers(projectId)` against the new `/api/redmine/users` and `/api/redmine/projects/:id/members` routes. Mock-only methods (`getDirectoryLinks`, `saveConnectionSettings`, `getConnectionSettings`) remain UI-config concerns and read/write from `localStorage` — they are not Redmine state.

### 7.3 Normalization & DTOs

There are **two type layers**, and the wire contract sits at the camelCase one.

| Layer | Lives in | Style | Example |
| --- | --- | --- | --- |
| Raw Redmine DTOs | `server/src/types/redmineDto.ts` (server-only) | **snake_case**, mirrors REST | `start_date`, `due_date`, `estimated_hours`, `done_ratio`, `parent_issue_id`, `custom_fields`, `enabled_modules` |
| Normalized app types | [src/types/redmine.ts](../src/types/redmine.ts) | **camelCase** | `startDate`, `dueDate`, `estimatedHours`, `doneRatio`, `parentIssueId`, `customFields`, `enabledModules` |

Adapters on the **server** (`server/src/adapters/*`) translate snake → camel before the response hits the wire. The browser never sees Redmine's snake_case shape.

If a DTO ever needs to be referenced from frontend test code (e.g. to assert "the wire sent us this exact object"), it imports a `.d.ts` mirror, not the runtime adapter — server code stays out of the browser bundle.

### 7.4 Caching & sync

- Introduce a tiny in-module cache in `realRedmineApi.ts`: `Map<cacheKey, { data, fetchedAt }>` with a 60-second TTL for list endpoints and 10 seconds for issue detail.
- `syncWithRedmine()` invalidates the whole cache and re-fetches the active page's data.
- The existing `useSyncBanner` hook in [src/hooks/useSyncBanner.ts](../src/hooks/useSyncBanner.ts) already exposes "last sync" — we feed it `fetchedAt` from the most recent successful call.
- Manual refresh button on each page calls `syncWithRedmine()` then the page's loader.
- Mock mode skips the cache entirely.

### 7.5 Gantt / resource planning data flow

The server's `/api/redmine/gantt` returns rows shaped for the existing [`ResourceTimeline`](../src/components/ResourceTimeline.tsx) component, derived from issues. Per-row fields (camelCase on the wire):

```
{
  id, issueId, projectId, projectName,
  subject,
  assigneeId, assigneeName,
  startDate, dueDate,
  estimatedHours, spentHours,
  doneRatio,
  parentIssueId, children[],
  relations[],            // for dependency lines
  isOverloaded,           // computed: sum of overlapping est hours > capacity
  isAtRisk                // computed: dueDate < today && doneRatio < 100
}
```

A new adapter `src/services/dto/ganttAdapter.ts` may be needed on the frontend only if we want to re-derive overlay state client-side (e.g. when the user shifts the visible week). Otherwise the server payload is rendered as-is.

### 7.6 Task hierarchy

A normalized hierarchy adapter lives in `src/services/dto/hierarchyAdapter.ts`. Input: flat `Issue[]`. Output:

```ts
type IssueNode = Issue & { depth: number; children: IssueNode[] };
```

This is what `ProjectBuilder`, `Dashboard`, and any future tree view consume. Built on the frontend (cheap, pure, easy to test) rather than the backend.

### 7.7 Quick edit / drawer save paths — **components will change**

Honest current state (verified against the files):

- [QuickEditPopup.tsx](../src/components/QuickEditPopup.tsx) currently calls **`updateIssue` and `createTimeEntry`** only.
- [TicketDrawer.tsx](../src/components/TicketDrawer.tsx) currently calls **`updateIssue` only**.

That means everything else listed in the brief — comments, subtasks, hierarchy edits, optimistic updates, error revert, write feedback — does **not** exist in those components today and **must be added**. Calling this "no component changes" was wrong in the previous draft. The honest list of component changes:

| Component | What changes |
| --- | --- |
| `QuickEditPopup.tsx` | Add optimistic-update + revert logic: snapshot pre-save state, apply patch locally, then either reconcile from server response or restore on error and show an error toast. Surface a "saving…" state and disable controls during the request. |
| `TicketDrawer.tsx` | Add **comment composer** wired to `addIssueComment(id, comment)`. Add **subtask composer** wired to `addSubtask(parentId, input)`. Add **parent picker / reparent** wired to `updateIssueHierarchy(id, parentId)`. Add **delete** action behind a confirm dialog wired to `deleteIssue(id)` (write-gated server-side). Optimistic update + revert + error toast on every save path. Surface "saving…" / "saved" / "error" state. |
| `IssueTable.tsx` | If it currently triggers writes anywhere, route those through the same optimistic/revert helper. |
| `useIssueEditor.ts` | This existing hook is the natural place to centralize the optimistic-update + revert + toast pattern so QuickEditPopup, TicketDrawer, and any future write surfaces share one implementation. Extend it; don't duplicate in each component. |
| Toast / inline feedback | The app does not have a global toast component yet. Either add a minimal one (preferred — small, reusable) or reuse the existing `StatusBanner` for write feedback. Pick during Phase 4 implementation. |

The facade signatures themselves do not change — `updateIssue`, `addIssueComment`, etc. are already on the `RedmineApi` interface. Only the **call surface inside components** grows.

### 7.8 UI surface audit (gaps vs. the backend)

A file-by-file audit of the current UI surfaced gaps beyond §7.7. They are listed here so the implementation cannot drift past them. Each item is grouped by category, with the affected files and the required change.

What the UI already gets right:

- Pages call the facade, not `realRedmineApi` directly. No page imports HTTP code.
- `AppShell` already wires a sync button → `syncWithRedmine()` → `useSyncBanner` for in-flight / success / error banner states.
- The mock-mode warning banner via `StatusBanner` is already present.

#### 7.8.1 Hardcoded metadata dropdowns

[QuickEditPopup.tsx](../src/components/QuickEditPopup.tsx), [TicketDrawer.tsx](../src/components/TicketDrawer.tsx), [AddTimeModal.tsx](../src/components/AddTimeModal.tsx), [ProjectBuilder.tsx](../src/pages/ProjectBuilder.tsx) import `mockUsers`, `mockProjects`, `mockIssueStatuses`, `mockPriorities`, `mockTrackers`, `mockTimeActivities` directly from [data/mockData.ts](../src/data/mockData.ts). In real mode these dropdowns would stay mock and silently disagree with Redmine.

**Change**: route every dropdown through the facade — `getUsers()`, `getProjectMembers(projectId)` (assignee pickers scoped to the issue's project), `getProjects()`, `getIssueStatuses()`, `getTrackers()`, `getPriorities()`, `getTimeActivities()`. Cache in `realRedmineApi.ts` per §7.4. The lookup-pattern in `QuickEditPopup` and `TicketDrawer` (e.g. `mockUsers.find((u) => u.id === Number(e.target.value))`) becomes a lookup against the fetched list held in state.

**Facade-internal coordinator (no component change).** §6 now bundles statuses + trackers + priorities + activities + the derived custom-fields catalog into a single `/api/redmine/metadata` response. The `RedmineApi` interface keeps `getIssueStatuses` / `getTrackers` / `getPriorities` / `getTimeActivities` / `getCustomFields` as separate named methods, so call sites do not change. Inside `realRedmineApi.ts`, all five methods share a single in-flight `Promise<MetadataBundle>` so the first call triggers one `/metadata` round-trip and subsequent calls (e.g. a drawer that opens four dropdowns) await the same promise. The shared promise honors §7.4's cache TTL and is cleared by `syncWithRedmine()`. Tests assert that opening a TicketDrawer triggers exactly one `/api/redmine/metadata` request, not four.

#### 7.8.2 `currentMockUser` references leak into real pages

Real pages currently import `currentMockUser` and use it as both an identity (`getMyIssues(currentMockUser.id)`) and a display name. Affected:

- [Dashboard.tsx:15,31](../src/pages/Dashboard.tsx)
- [Home.tsx:26,78,113](../src/pages/Home.tsx) (renders the greeting using `currentMockUser.name`)
- [MyHours.tsx:3,14,24](../src/pages/MyHours.tsx)
- [MyTasks.tsx:7,15,25](../src/pages/MyTasks.tsx)
- [ResourceManagement.tsx:4,32–34](../src/pages/ResourceManagement.tsx)
- [Tasks.tsx:6,25,31,63,66](../src/pages/Tasks.tsx)
- [QuickEditPopup.tsx:79](../src/components/QuickEditPopup.tsx) (uses `/my-tasks?id=`, not a `currentMockUser` reference, but the broader page does)

**Change**: hydrate the current user with `getCurrentUser()` once at app start (a `useCurrentUser` hook or a context — either is fine) and read from it everywhere. Stop importing `currentMockUser` from `data/mockData.ts` in `src/pages/**` and `src/components/**`.

#### 7.8.3 Settings page collects an API key in the browser

[Settings.tsx:109–126](../src/pages/Settings.tsx) renders an `<input type="password">` for the Redmine API key and persists it via `saveConnectionSettings`. This contradicts the core guardrail — the key must never reach the browser.

**Changes**:

- Remove the API key input and the `apiKey` field from the on-screen form.
- Replace the Redmine connection card with a **read-only** status panel showing two distinct signals (do not collapse them into a single "Connected" indicator — they fail independently):
  - **Backend reachable.** Whether the dashboard can reach its own proxy at `VITE_API_BASE`. Derived from a ping-style call (e.g. `/api/redmine/health` or `testConnection()` returning successfully). If this is red, nothing else matters.
  - **Redmine reachable.** Whether the proxy can in turn reach Redmine. Comes from the `connected` field on `ConnectionStatus` once the proxy answers. If the backend is up but Redmine is down, this is the signal the operator needs.
  Also show: `VITE_API_BASE` itself, mock mode (informational, read from the build flag), `readOnly` flag (§7.8.8), current user, last sync.
- Drop or downgrade the "Mock data mode" checkbox to read-only. Mock mode is a build-time `VITE_MOCK_MODE` flag — a runtime checkbox cannot actually flip it without a reload.
- Keep the security note, but flip it from a warning to a positive description of what the backend proxy does ("Calls are routed through the secure backend at …").

#### 7.8.4 TicketDrawer write affordances are stubs

[TicketDrawer.tsx](../src/components/TicketDrawer.tsx) has visible affordances that do not work today.

| Affordance | Line | Current state | Required wiring |
| --- | --- | --- | --- |
| Comment composer | 263 | `<textarea>` with no state; "Post comment" has no `onClick` | Local draft state → `addIssueComment(id, comment)` → optimistic append to a rendered journal list |
| Add subtask | 277 | Button with no handler | Small composer (subject, optional tracker/assignee) → `addSubtask(parentId, input)` → append to children |
| Log time | 280 | Button with no handler | Either open `AddTimeModal` pre-filled with this issue, or inline composer → `createTimeEntry` |
| Duplicate | 282 | Button with no handler | Either remove or wire to `createIssue` from current draft (write-gated) |
| Mark complete | 287 | Mutates local draft only — user must hit Save | Show "Save to apply" hint, or auto-save through the optimistic helper |
| Parent task | 222 | Saved through generic `updateIssue` | Route through `updateIssueHierarchy(id, parentId)`; backend route is `PUT /api/redmine/issues/:id/parent` |
| Custom fields | 245 | Hardcoded "No custom fields configured" placeholder | Iterate `draft.customFields` and render each `{ id, name, value }` — per-issue values are readable even when the global custom-fields endpoint is 403 |
| Delete | — | Not present | Add a delete button behind a confirm dialog → `deleteIssue(id)`; write-gated |

#### 7.8.5 QuickEdit "Short comment" textarea is a no-op

[QuickEditPopup.tsx:170–176](../src/components/QuickEditPopup.tsx) renders a comment textarea with no state and no save path. Either remove it or wire it to `addIssueComment` after `updateIssue` succeeds.

#### 7.8.6 No global error/feedback surface for write failures

Both `QuickEditPopup.save` and `TicketDrawer.save` use `try / finally` that only resets `saving` — errors are swallowed ([QuickEditPopup.tsx:39–58](../src/components/QuickEditPopup.tsx), [TicketDrawer.tsx:36–44](../src/components/TicketDrawer.tsx)). When the backend returns 403 (read-only) or 4xx/5xx, the user sees nothing.

**Change**: introduce a minimal toast component (preferred) or extend `StatusBanner` with a `reportError(message)` path, and route every write flow through it — including the new comment, subtask, reparent, delete, and time-log flows.

#### 7.8.7 Optimistic update + revert is not implemented

The current save pattern is `setSaving(true) → await … → setSaving(false) → onSaved`. There is no local optimistic apply, no revert on error, no per-field "saving…" indicator. [useIssueEditor.ts](../src/hooks/useIssueEditor.ts) already exists; per §7.7 it becomes the home of `snapshot → patch → reconcile-or-revert → toast`. Replace the direct save calls in `QuickEditPopup` and `TicketDrawer` with calls into the extended hook.

#### 7.8.8 Read-only mode awareness

The backend returns 403 for every non-GET when `REDMINE_READ_ONLY=true`. The UI currently has no concept of this, so Save / Post / Delete / Add buttons stay enabled and fail silently.

**Changes**:

- Surface a `readOnly: boolean` field on `ConnectionStatus` (already returned by `testConnection()`).
- Add a `useReadOnly()` hook that reads it once at app start.
- Disable (with tooltip "Read-only mode") every write affordance when the flag is set: Save (QuickEdit, Drawer), Post comment, Add subtask, Log time, Duplicate, Delete, Mark complete, "Add time entry" entry points across `TimeTracking` / `MyHours` / `TeamHours`.
- **Add a "Read-only mode" badge in `TopBar`** next to the sync button when the flag is set, so the global state is discoverable rather than only inferred from greyed-out buttons. Use the existing brand pill style; no new component is needed. The badge is hidden when writes are allowed.

#### 7.8.9 Last-sync surfacing

Plan §7.4 wants "last sync" visible per page. Today it only appears in [Settings.tsx:160–163](../src/pages/Settings.tsx).

**Change**: surface a short "Last sync HH:MM" chip in `TopBar` next to the existing sync button (preferred — it's where the user already clicks to sync). The value comes from `useSyncBanner`'s status; no new state needed.

#### 7.8.10 Per-page manual refresh

Plan §7.4 calls for a per-page refresh control. Today there is only the global TopBar sync.

**Decision (revised).** The previous draft separated "page refresh" from "global sync" so that pages would re-render without invalidating the facade cache. In practice that produces two near-identical buttons with confusingly different behavior — a user who clicks "Refresh" on a stale page expects fresh data, not a re-render of the cached payload. Collapse them:

- The global `TopBar` sync button stays the single source of truth: it calls `syncWithRedmine()` (cache invalidate) followed by the active page's loader.
- Each data page (Dashboard, MyTasks, PastDue, Tasks, TimeTracking, MyHours, TeamHours, Projects, ResourceManagement) exposes its loader to `AppShell` (via context or a route-level callback) so the global sync can re-trigger it after invalidation. The page itself does **not** add a second button.
- The "Last sync HH:MM" chip from §7.8.9 sits next to that single sync button, so the user can read the staleness and act on it from one place.

If a page genuinely needs a "re-render without re-fetch" affordance later (e.g. to redraw a Gantt after the user changes the visible week), that's a UI-local control on the page, not a refresh button.

#### 7.8.11 `ResourceTimeline` input shape vs. `/api/redmine/gantt`

[ResourceTimeline.tsx:7–13](../src/components/ResourceTimeline.tsx) takes three separate props (`users`, `issues`, `allocations`) and groups them client-side. The plan's `/api/redmine/gantt` returns one normalized array with `isOverloaded` and `isAtRisk` pre-computed.

**Decision (recommended)**: keep the current prop shape; have `realRedmineApi.getResourceAllocations` derive its return value from `/api/redmine/gantt` rows. The component does not change. (Less UI churn; server-side derivation still owns the work.)

Alternative: change `ResourceTimeline` to accept a single `rows: GanttRow[]` prop, then update its wrappers in [ResourceManagement.tsx](../src/pages/ResourceManagement.tsx) and [Tasks.tsx](../src/pages/Tasks.tsx). Only pick this if the current three-prop split is actively painful.

#### 7.8.12 `getCustomFields()` returns `[]` in real mode

Anywhere the UI relied on `getCustomFields()` for a global catalog must handle `[]` gracefully. Today there are no real consumers (the drawer hardcodes a "not configured" placeholder), so this is mostly forward-looking: every place that lists "available custom fields" needs an empty-state ("No catalog available — values shown per issue") rather than a blank dropdown.

#### 7.8.13 `MOCK_TODAY` must not leak into real mode

[lib/format.ts](../src/lib/format.ts) pins `MOCK_TODAY = 2026-05-21` and the value is referenced by [ResourceTimeline.tsx:29](../src/components/ResourceTimeline.tsx) and the past-due loader. In real mode "today" must be `new Date()`.

**Change**: either replace `MOCK_TODAY` references with `new Date()` in real-mode code paths, or gate it on `import.meta.env.VITE_MOCK_MODE`. The cleanest fix is a `getToday()` helper that returns `MOCK_TODAY` only when `VITE_MOCK_MODE === 'true'`.

### 7.9 UI-change sequencing (can land before backend)

Phases 1–4 here are pure frontend work that does not depend on the backend existing — they continue to behave correctly in mock mode while removing the structural blockers for real mode. Phases 5–7 land alongside the backend write routes.

1. **Metadata + user/project hydration** (§7.8.1, §7.8.2). Pure refactor. Mock mode behavior unchanged.
2. **Settings page rewrite** (§7.8.3). Removes the API-key leak risk before any backend code lands.
3. **Error/toast surface + `useIssueEditor` extension** (§7.8.6, §7.8.7). Required before writes can be safe.
4. **Read-only mode awareness** (§7.8.8). Required before any write route is enabled.
5. **TicketDrawer + QuickEdit write affordances** (§7.7, §7.8.4, §7.8.5). The bulk of the write story; lands alongside backend §9.
6. **Last-sync + per-page refresh** (§7.8.9, §7.8.10). Polish.
7. **Gantt shape decision + custom-fields fallback + mock-today guard** (§7.8.11, §7.8.12, §7.8.13). Cleanup.

---

## 8. Tests

### Backend (Vitest in `server/test/`, owns its own `vitest.config.ts`)

- One `*.test.ts` per route. Use `vi.fn()` to stub `fetch` and assert:
  - URL + query string Redmine receives
  - `X-Redmine-API-Key` header is set
  - Non-GET is rejected when `REDMINE_READ_ONLY=true`
  - Adapter output is camelCase and matches `src/types/redmine.ts`
  - Error shapes for 401 / 403 / 404 / 5xx from Redmine
- Adapter tests use small **anonymized** Redmine-shaped JSON fixtures (`server/test/fixtures/*.json`). Examples only: `Project A`, `Issue: anonymized 1`, `User: Test One`. No real subjects, project names, descriptions, or user names.
- Gantt derivation test: feed mixed parent/child issues with overlapping date ranges, assert `isOverloaded` lights up for the overloaded assignee and only that one.
- Users / members routes have their own tests verifying paging, filters, and adapter output.

### Frontend (existing Vitest)

- `services/realRedmineApi.test.ts` (new): mocks `fetch`, asserts each method hits the right path with the right method/body and parses responses correctly. Covers `getUsers`, `getProjectMembers`, all GET, all write paths.
- `services/dto/hierarchyAdapter.test.ts` (new): parent → children resolution, multi-level depth, orphan rows.
- Existing tests stay green — they import from the facade, and mock mode is unchanged. We add a small extra suite that runs the facade in `VITE_MOCK_MODE=false` against a mocked `fetch` to prove parity.
- `QuickEditPopup.test.tsx`: extend to cover optimistic-update + revert on error and time-log creation.
- `TicketDrawer.test.tsx`: extend to cover the new comment, subtask, reparent, and delete flows plus their optimistic/revert behavior.
- New `useIssueEditor.test.ts` cases for the shared optimistic-update helper.

### Validation gate

CI must pass:

```
npm run typecheck
npm run lint
npm test
npm run build
```

Plus a new `npm --workspace server run test` step (added to `.github/workflows/ci.yml`), and the Windows CI smoke job from Phase 0.

---

## 9. Implementation order

Each step ends green (typecheck + lint + tests + build). No step touches more files than necessary.

0. **Phase 0 - Preflight.** Fix `npm test` and `npm run build` on a clean Windows install per Section 4.1. Add the workspace skeleton per Section 4.2.
1. **Bootstrap `server/`.** Hono app, `/health` route, env loader, dev script. Update `.env.example` and root `package.json` workspaces.
2. **Read-only middleware + error handler + request id + rate limit (in-memory).**
3. **`GET /api/redmine/me` + `/projects` + `/projects/:id` + `/projects/:id/members` + `/users`** with adapters and tests. Project **list** stays without `include=`; project **detail** loads `enabled_modules,trackers,issue_categories`.
4. **`GET /api/redmine/issues` + `/issues/:id`** with adapters and tests. Snake → camel translation enforced by adapter tests.
5. **`GET /api/redmine/metadata` + `/time-entries`.** Metadata bundles statuses, trackers, priorities, time activities, and the derived custom-fields catalog (sampled from issues/projects — never `/custom_fields.json`).
6. **`GET /api/redmine/gantt`** with derivation + tests.
7. **`realRedmineApi.ts`**: replace stubs with HTTP for all GET methods, including `getUsers`, `getProjectMembers`, and the degraded `getCustomFields` that consumes the metadata bundle. Frontend now works against real Redmine in read-only mode.
8. **Frontend real-mode readiness before writes.** Land metadata/user hydration (Sections 7.8.1 and 7.8.2), Settings page rewrite (Section 7.8.3), error/toast + extended `useIssueEditor` (Sections 7.8.6 and 7.8.7), and read-only mode awareness (Section 7.8.8). All four work in mock mode and must land before any write route is enabled.
8a. **Admin auth + history store (§14.3, §14.5).** Backend auth routes, session middleware, history SQLite store, sync-event capture wired into `syncWithRedmine()`. No frontend yet. Lands in parallel with the Redmine integration; does not block Step 9.
8b. **Admin login + route guard (§14.4).** Frontend `useSession`, `Login` page, `RequireAdmin` guard, sidebar visibility gated on session. Mock mode preserved.
8c. **Admin page tabs (§14.1).** Users / Permissions / History tabs against `/api/admin/*`.
9. **Cache + manual refresh + last-sync wiring** through `useSyncBanner`.
10. **Write routes** behind `REDMINE_READ_ONLY=false`: `PATCH /issues/:id`, `POST /issues`, `POST /issues/:id/comments`, `POST /issues/:id/subtasks`, `PUT /issues/:id/parent`, `POST /time-entries`, `DELETE /issues/:id`.
11. **Frontend write paths and component changes** per Sections 7.7 and 7.9 phase 5: add comment / subtask / reparent / delete affordances to `TicketDrawer`, harden `QuickEditPopup` with the optimistic/revert helper.
12. **UI polish & cleanup**: per-page refresh + last-sync chip (Sections 7.8.9 and 7.8.10), Gantt shape decision (Section 7.8.11), custom-fields empty-state (Section 7.8.12), `MOCK_TODAY` guard (Section 7.8.13).
13. **Rate-limit production story.** If deploying to more than one process, add the Redis-backed `RateLimitStore` adapter and a `RATE_LIMIT_BACKEND` env switch.
14. **README + [docs/ARCHITECTURE.md](./ARCHITECTURE.md) + [docs/API.md](./API.md) updates**: secure setup steps, `.env.local` instructions, how to flip mock mode, how to run the backend, how to enable writes, custom-fields degradation note, rate-limit guidance.
15. **Final validation pass**: full CI suite + manual smoke through Dashboard / My Tasks / Past Due / Resource Management / Time Tracking against a real Redmine instance.

Steps 1-9 can land while `REDMINE_READ_ONLY=true`. Step 10 and the write behavior in Step 11 are gated on the operator flipping `REDMINE_READ_ONLY=false` in their environment. The read-only UI awareness in Step 8 is not gated; it must land before writes are exposed.

---

## 10. Risks and how we handle them

| Risk | Mitigation |
| --- | --- |
| Vitest or Vite build fails on Windows because esbuild can't load the Vite config | Phase 0.1 reproduces from a clean install, removes generated `vite.config.d.ts` / `vite.config.js` shadow files, isolates test config in `vitest.config.ts` if needed, and adds a Windows CI job so the regression cannot land silently. Tests and build are fixed, not skipped. |
| Redmine custom fields endpoint returns 403 | Never call `/custom_fields.json`. Backend builds a degraded catalog from issue/project samples and returns `[]` if it can't (see §6 Notes). Per-issue values are passed through. |
| Project list `include=` not honored on this Redmine version | `/api/redmine/projects` ships without `include=`; UI calls `/projects/:id` for `enabled_modules,trackers,issue_categories`. |
| Redmine rate limits or slow responses | Backend cache (where appropriate), per-IP rate limit, list endpoints capped at `limit=100`. |
| Rate-limit counter ineffective across replicas | In-memory bucket is the default; documented as single-process only. Redis-backed `RateLimitStore` is the production path, swapped in via env. |
| API key or company data leaks through logs/errors | Error handler strips the request URL's auth (we never put the key in the URL anyway), never logs request bodies, and tests assert logs omit API keys, issue subjects, descriptions, comments, customer names, and user emails. |
| Production env stores key in a `VITE_*` var by accident | `.env.example` is fixed; lint rule (`no-restricted-syntax`) blocks `import.meta.env.VITE_*KEY*` references in `src/`. |
| Settings page collects a real API key in the browser (current UI) | §7.8.3 removes the input and the `apiKey` field; the only credential in the browser is the backend session, never the Redmine key. Land before any real-mode rollout. |
| Write affordances stay enabled when backend is read-only and silently 403 | §7.8.6 + §7.8.8: error/toast surface plus a `useReadOnly()` hook that disables Save / Post / Delete / Add buttons with a "Read-only mode" tooltip. |
| Real-mode pages still render based on `currentMockUser` | §7.8.2: hydrate via `getCurrentUser()` and remove `currentMockUser` imports from `src/pages/**` and `src/components/**` before turning off `VITE_MOCK_MODE`. |
| Mock fixtures drift from real Redmine shape | DTO test loads a tiny anonymized real-shape fixture and runs the adapter on it; if Redmine changes shape, this fails fast. |
| Backend deployed without backend env vars | Server fails to boot in non-mock mode if `REDMINE_BASE_URL` or `REDMINE_API_KEY` missing. No silent fallback. |
| Browser bundle accidentally imports `server/` code | `server/` is its own workspace with no `src/` import; ESLint `no-restricted-imports` blocks `server/*` from `src/*`. |
| `dist/` deploy to GitHub Pages no longer works because Pages can't proxy | Backend is hosted separately (Render/Fly/Vercel function). Frontend `VITE_API_BASE` points at the backend's public URL. Pages stays static. |
| snake_case Redmine fields leak into the browser | Adapter tests assert no `start_date` / `due_date` / `estimated_hours` / `done_ratio` / `parent_issue_id` keys exist on the wire payload. |
| Admin password leaks via repo or logs | Only the bcrypt hash sits in `.env.local` (gitignored); plaintext is never persisted. Tests assert logs and error responses never contain `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, or session ids. |
| Admin session hijacked | `HttpOnly` + `Secure` + `SameSite=Lax` cookies; server-side session store keyed by random session id; `SESSION_SECRET` rotation invalidates all sessions. |
| Brute-force login | `/api/auth/login` rate-limited at 5/min/IP via the same `RateLimitStore`; every failure recorded in `login_events`. |
| Admin enumeration via differing error messages | Login responses do not distinguish "user not found" from "wrong password"; both return the same generic error. |

---

## 11. Deliverables (matches brief)

- `server/` Hono backend with the routes in §6, env config, read-only middleware, in-memory rate limit (Redis adapter optional), tests.
- Frontend `realRedmineApi.ts` implementing the full `RedmineApi` contract over HTTP, including `getUsers`, `getProjectMembers`, and the degraded `getCustomFields`.
- Typed Redmine DTOs (`server/src/types/redmineDto.ts`, snake_case) and normalized app types (existing [src/types/redmine.ts](../src/types/redmine.ts), camelCase). Translation only happens in `server/src/adapters/*`.
- Gantt / resource adapter on the server, optional re-derivation hook on the frontend.
- Task hierarchy adapter on the frontend (`src/services/dto/hierarchyAdapter.ts`).
- **Component updates** for comments / subtasks / reparenting / optimistic-and-revert / delete (§7.7) — not "no changes".
- Updated [README.md](../README.md), [docs/ARCHITECTURE.md](./ARCHITECTURE.md), [docs/API.md](./API.md) with secure-setup steps, custom-fields degradation, rate-limit guidance.
- Vitest suites: server routes + adapters + middleware; frontend facade + hierarchy + Gantt + quick edit + drawer + write flows + time entry.
- Validation summary: output of `typecheck`, `lint`, `test`, `build` for both workspaces, plus the Windows CI smoke job.

---

## 12. Verification of this plan

Cross-checked against the repo before writing:

- `.env.local` and `.env*` are already gitignored — confirmed in [.gitignore:5-7,19-20](../.gitignore). No new gitignore work needed.
- Current `.env.example` ships `VITE_REDMINE_API_KEY` — this **is the leak we are removing**. Plan §3 deletes that line.
- The facade at [src/services/redmineApi.ts](../src/services/redmineApi.ts) already binds methods from a selected impl. Call site signatures stay the same; only behaviors inside write-flow components grow.
- The stub at [src/services/realRedmineApi.ts](../src/services/realRedmineApi.ts) is where stubs become `fetch`. Confirmed by reading.
- The `RedmineApi` interface at [src/services/redmineApiTypes.ts](../src/services/redmineApiTypes.ts) already includes `getUsers()` and `getProjectMembers(projectId)`; the corresponding backend routes are added in §6 to back them.
- Domain types in [src/types/redmine.ts](../src/types/redmine.ts) are camelCase. Redmine REST is snake_case. Translation lives only in `server/src/adapters/*`.
- Component audit verified the §7.7 claims: [QuickEditPopup.tsx](../src/components/QuickEditPopup.tsx) imports only `updateIssue, createTimeEntry`; [TicketDrawer.tsx](../src/components/TicketDrawer.tsx) imports only `updateIssue`. Everything else in the brief (comments, subtasks, reparenting, optimistic updates) is new component work.
- Existing tests in [src/tests/api.test.ts](../src/tests/api.test.ts) exercise the facade — they remain valid because `VITE_MOCK_MODE` stays the switch.
- Vite dev server uses [vite.config.ts](../vite.config.ts); we will add a `server.proxy` block pointing `/api` → `http://localhost:8787` for local dev so the existing `npm run dev` still works against the backend.
- No existing backend, no existing `server/` directory — greenfield for the proxy.

The plan does not invent any Redmine endpoints — every Redmine REST URL in §6 already appears in [docs/API.md:87-115](./API.md), and the 403-on-custom-fields constraint from the brief is honored.

---

## 13. Current validation results

Ran against the working tree during this review:

| Command | Result |
| --- | --- |
| `npm run typecheck` | **pass** |
| `npm run lint` | **pass** |
| `npm test` | **fail** - esbuild cannot read parent directory and cannot resolve `vite.config.ts` |
| `npm run build` | **fail** - esbuild cannot read parent directory and cannot resolve `vite.config.js` |

The Vitest/Vite-config failure mode flagged in the brief **does reproduce now**. Phase 0.1 is the first implementation blocker: fix config loading for both `npm test` and `npm run build` before backend work resumes, and do **not** skip tests as a workaround.

---

## 14. Admin & Audit page

A new admin surface gated by login. Scope confirmed: **v1 single-admin auth**, **history captures sync and login events only** (no per-write audit log; no journal mirror).

### 14.1 Scope and shape

- New route `/admin` in the existing AppShell, plus `/login` for unauthenticated access. Brand and shell unchanged.
- Three tabs inside `/admin`:
  1. **Users.** Read-only mirror of Redmine users via `/api/redmine/users` plus each user's memberships pulled from `/api/redmine/projects/:id/members`. Searchable, filterable by status / project / role. Source of truth stays Redmine.
  2. **Permissions.** Project × user × role matrix aggregated from the same memberships. Answers "what can $person see?" at a glance. No editing — Redmine remains the place to grant/revoke.
  3. **History.** Filterable list combining **sync events** (when `syncWithRedmine()` ran, who triggered it from where, success/error) and **login events** (successful logins, failed attempts with source IP). No write-audit and no journal mirror in v1.

### 14.2 Auth model — v1 single admin

- One admin identity defined entirely in env:
  - `ADMIN_USER` — username string.
  - `ADMIN_PASSWORD_HASH` — bcrypt hash (cost ≥ 12) of the password. Plaintext password never stored, never logged.
  - `SESSION_SECRET` — random ≥ 32-byte string used to sign session cookies.
- `/api/auth/login` accepts `{ user, password }` over POST, verifies with `bcrypt.compare`, sets a signed session cookie, returns `{ user, loginAt }`.
- Cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, expiry 12 h with rolling refresh on activity. Cookie value is opaque; the server stores session state keyed by a random session id.
- `/api/auth/logout` clears the cookie and the server-side session entry.
- `/api/auth/me` returns the current session (used by `useSession()` to gate routes).
- **Rate limit**: `/api/auth/login` capped at 5 attempts / minute / IP using the same `RateLimitStore` interface from §6. Failed attempts also count toward the lockout and are written to the history log.
- **No user enrollment** in v1. The Users tab is purely a Redmine mirror.

### 14.3 Backend additions

```
server/src/
  routes/
    auth.ts                 # POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
    admin/
      users.ts              # GET /api/admin/users  (mirrors /api/redmine/users + memberships)
      permissions.ts        # GET /api/admin/permissions  (derived matrix)
      history.ts            # GET /api/admin/history  (sync + login events, filterable)
  middleware/
    session.ts              # verifies signed cookie, attaches { user } to context; 401 on miss
    requireAdmin.ts         # 403 if session is missing or not admin (v1: any session is admin)
  store/
    sessionStore.ts         # in-memory map keyed by session id (single-process); pluggable later
    historyStore.ts         # SQLite-backed append-only store; one table per event kind
  auth/
    password.ts             # bcrypt compare wrapper; no plaintext leaves this file
```

Env additions (server-side only, in `.env.local`, gitignored):

```
ADMIN_USER=...
ADMIN_PASSWORD_HASH=...          # generate with `node scripts/hash-password.js`
SESSION_SECRET=...               # generate with `openssl rand -base64 48`
HISTORY_DB=./server/data/history.sqlite
```

History store schema (SQLite, kept tiny):

```sql
CREATE TABLE sync_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,              -- ISO8601
  actor TEXT NOT NULL,           -- session user
  trigger TEXT NOT NULL,         -- 'topbar' | 'page:<route>' | 'auto'
  status TEXT NOT NULL,          -- 'success' | 'error'
  duration_ms INTEGER,
  error_message TEXT,            -- redacted; no bodies
  request_id TEXT NOT NULL
);

CREATE TABLE login_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  user TEXT NOT NULL,            -- attempted user (truncated if pathological)
  status TEXT NOT NULL,          -- 'success' | 'failed' | 'rate_limited'
  source_ip TEXT,                -- best-effort, may be null behind proxy
  request_id TEXT NOT NULL
);
```

Append paths:

- `sync_events` — written by the existing `syncWithRedmine()` handler at start (status `success`) or in the error path. Trigger is sniffed from a header the frontend sends (`X-Sync-Trigger`).
- `login_events` — written by `auth.ts` on every login attempt, including rate-limit rejections.

History reads (`GET /api/admin/history`) accept filters: `kind=sync|login|all`, `since`, `until`, `status`, `limit`, `offset`. Default limit 100, max 500.

### 14.4 Frontend additions

```
src/
  pages/
    Login.tsx               # username + password form; reads /api/auth/login
    Admin.tsx               # tabbed: Users / Permissions / History
  components/
    admin/
      UsersTab.tsx
      PermissionsTab.tsx
      HistoryTab.tsx
  hooks/
    useSession.ts           # fetches /api/auth/me on mount; exposes { user, loading, signIn, signOut }
  services/
    adminApi.ts             # facade with mock + real impls, same pattern as redmineApi.ts
    mockAdminApi.ts
    realAdminApi.ts
```

Routing:

- A new `<RequireAdmin>` route guard in `App.tsx` wraps `/admin`. Unauthenticated requests redirect to `/login?next=/admin`.
- Admin entry point in the existing `Sidebar.tsx` is visible only when `useSession()` reports an authenticated user. No flash of admin link on unauthenticated loads.

Mock mode behavior:

- `useSession()` in mock mode returns a fixed `{ user: 'admin (mock)', mock: true }` without a real login, preserving the local demo flow.
- `StatusBanner` adds a "Mock admin session" note on the admin page so it's obvious "you are admin" is not real.

### 14.5 Security guardrails specific to this surface

- Sessions are server-side; cookies hold only a signed session id, not user data.
- `SESSION_SECRET` rotation invalidates all sessions — document this in the README.
- Login route audited regardless of outcome; success and failure both land in `login_events`.
- Login responses do not distinguish "user not found" from "wrong password" — both return the same generic error.
- `/api/admin/*` routes require a session. They never accept an API key, never accept basic auth.
- Admin routes still go through the `readOnly` middleware. With `REDMINE_READ_ONLY=true`, the admin page can view everything but cannot write — same gate as the rest of the app.
- Logs never contain passwords, session ids, or `SESSION_SECRET`. Tests assert this.
- The Users tab does not surface user email by default — it's behind a "show details" toggle so the operator opts into displaying PII.

### 14.6 Tests

Backend:

- `routes.auth.test.ts` — login success, wrong password (generic error), missing user (generic error), rate limit, audit log written for each.
- `middleware.session.test.ts` — 401 on missing cookie, valid cookie attaches `{ user }`, expired cookie cleared.
- `routes.admin.users.test.ts` / `permissions.test.ts` — verify aggregation logic against anonymized Redmine fixtures.
- `routes.admin.history.test.ts` — filters, pagination, default ordering (`at DESC`).
- `auth.password.test.ts` — bcrypt round-trip; no plaintext leaks via toString / JSON.

Frontend:

- `pages/Login.test.tsx` — submits, redirects to `next` on success, surfaces the generic error on failure.
- `pages/Admin.test.tsx` — tab switching, table rendering, filter wiring.
- `hooks/useSession.test.ts` — mock-mode session, real-mode session, sign-out clears state.
- `services/adminApi.test.ts` — facade switches by `VITE_MOCK_MODE`.

### 14.7 Implementation order placement

§14 work lands as a parallel track to the Redmine integration, not blocking it. Concrete sequencing inside §9:

- After §9 Step 8 (frontend real-mode readiness) but before §9 Step 10 (writes go live):
  - **Step 8a**: Backend auth route + session middleware + history store schema + sync-event capture wired into the existing sync handler. No frontend yet.
  - **Step 8b**: Frontend `useSession`, `Login` page, `RequireAdmin` guard, sidebar visibility.
  - **Step 8c**: Admin page tabs (Users, Permissions, History).
- The History tab gains data over time; on day 1 it will be near-empty, which is fine — the value is being there before incidents happen.

### 14.8 Out of scope for v1 (explicit non-goals)

- No multi-user enrollment, password reset, or per-user roles. Promote to v2 when more than one operator needs admin.
- No write-action audit log. Adding it later is a single new table (`write_events`) plus a hook in the write middleware; no schema migration of existing data.
- No cross-issue journal mirror. Redmine already has this view; duplicating it would widen our cache surface for low marginal value.
- No SSO / OIDC. Out of scope; v2 territory.
