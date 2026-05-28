# Session handoff

Snapshot to continue this work in a fresh window. Repo:
`C:\Users\nbraithwaite\redmine-ops-dashboard` (Windows).

_Last updated: 2026-05-28._

## Where things stand

- **On branch `azure-app`**, working tree clean. Local-only commits ahead of
  `origin/azure-app` (CR #29 series — see below). Push when ready.
- Branches:
  - `main` — the app (current features through CR #27). Pushed.
  - `azure-app` — `main` + all features + single-Node Azure App Service
    packaging + CR #28 (Entra sign-in) + CR #29 (Redmine perf).
  - `cr-17-19-dashboard-tabs-team-work` — old PR branch, can be deleted.
  - (Deleted earlier: `azure-enterprise-app`, `azure-single-node` → consolidated
    into `azure-app`.)

## CR #28 — Microsoft Entra sign-in (shipped, flag-gated)

Shipped at `71bb9ed`. Off by default (`MS_AUTH_ENABLED=false`).

### How CR #28 works
- Backend `/api/auth/ms/{signin,redirect,me,signout}` — MSAL Node auth-code +
  PKCE, **query** response mode (so the `SameSite=Lax` cookie survives the
  redirect over plain http in dev). Per-session MSAL state in an in-memory
  store (single-process; Redis later for multi-instance).
- Frontend: `useMsAuth` reads `/api/auth/ms/me`; when `enabled && !authenticated`
  the whole app shows `MsSignIn`.
- Identity in `.env.local` (gitignored): `MS_AUTH_ENABLED=false`, `MSAL_CLIENT_ID=6ae74c8d-fe2f-4fec-8196-d6f73b977497`,
  `MSAL_TENANT_ID=83531264-2270-406c-a223-6f240151d473`, `MSAL_CLIENT_SECRET`,
  `MSAL_REDIRECT_URI=http://localhost:5173/api/auth/ms/redirect`, etc.

### To activate CR #28 (Azure-side, then flip flag)
1. Register redirect URI `http://localhost:5173/api/auth/ms/redirect` (and the
   prod `https://<app>.azurewebsites.net/api/auth/ms/redirect`) in app
   registration `6ae74c8d-fe2f-4fec-8196-d6f73b977497` (Authentication → Web).
2. Set `MS_AUTH_ENABLED=true` in `.env.local`, restart backend.
   (Note: this app reg is the *sign-in* identity — different from the Dataverse
   app reg `be036e54-…`.)

## Backlog (open)

- **CR #29 — Speed up Redmine API pulls**: ✅ Shipped 2026-05-28. Cold gantt
  **5.05s** (was ~9s), warm **<20ms**. Server-side TTL cache + SWR +
  in-flight coalescing + parallel pagination + boot-time warmer for hot
  keys. Browser cache ripped out (server is now authoritative);
  `syncWithRedmine` POSTs `/api/admin/_cache/invalidate`. See
  `docs/CHANGE_REQUESTS.md` #29 and `CHANGELOG.md`.
- **CR #26 — TrackOpportunities CRM card** (Home card: 80–100% default
  probability filter, spring-up detail with aircraft/customer/topic +
  probability filters; 3D plane models later). **Blocked**: Dataverse
  **Application User** must be added (read on TrackOpportunities) before the
  schema can be discovered — auth works but the API 403s
  ("user is not a member of the organization"). Discovery script:
  `node server/scripts/dynamics-discover.mjs`.
- **CR #21 — Dynamics/Dataverse CRM integration** (broader). Creds in
  `.env.local` (`DATAVERSE_*`); same Application User blocker.
- **Azure deploy**: `azure-app` is deploy-ready (single Node app). Needs an
  Azure **Linux App Service** (Node 20), startup `npm start`,
  `SCM_DO_BUILD_DURING_DEPLOYMENT=true`, secrets in Application Settings.
  See `docs/AZURE_DEPLOY.md`.
- **Section 15 — live Redmine writes**: ✅ validated (created time entry
  #130005 on issue #66781, then reverted to read-only). `REDMINE_READ_ONLY=true`
  now.
- **On hold**: CR #20 (manual custom metrics — superseded by CRM).
- **Deferred platform epic** (`docs/ROADMAP.md`): A Entra SSO (CR #28 is the
  first slice) → B per-user Redmine keys → C RBAC → D Redis/DB → E scaled CRM
  sync → F deployment.

## Running it

```
npm run dev:all        # web :5173 + api :8787 (real mode, live redmine.avionica.com, read-only)
npm run build && npm start   # single-node prod build (azure-app only): node server/dist/index.js
npm run typecheck && npm run lint && npm test
```

- Live API is slow: the team **gantt** (project 127) is ~9s/295 KB — the
  Dashboard Team tab + Hours "Show team" trigger it. Other calls 1–3s.
- The Dashboard backend process has died once under heavy repeated reloads; if
  the UI hangs on "loading/0", check `curl http://localhost:8787/health` and
  restart `npm run dev:server`.
- Tests run in mock mode (`VITE_MOCK_MODE=false` is for the live app; tests
  force mock). Framer Motion exit/layout needs `prefers-reduced-motion` mocked
  in jsdom — see existing `*Detail.test.tsx` for the matchMedia pattern.
