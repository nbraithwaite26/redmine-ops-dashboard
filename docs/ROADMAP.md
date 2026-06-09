# Roadmap

Forward-looking plan for the Redmine Operations Dashboard. Complements
[`CHANGE_REQUESTS.md`](./CHANGE_REQUESTS.md) (active CRs) and
[`archive/CHANGE_REQUESTS_SHIPPED.md`](./archive/CHANGE_REQUESTS_SHIPPED.md) (what's shipped).

Split into **Now** (build-ready on the current single-team architecture) and
**Later** (the platform evolution to team hosting — planned and sequenced, but
intentionally deferred).

## Now — build-ready (no platform rework)

These run on today's architecture (single shared Redmine key, single admin)
and deliver value without the multi-user work below.

- **CR #30 — Portable per-user desktop build** *(planned)*. Bun-compiled
  Windows .exe each teammate runs on their own PC. First launch prompts for
  Redmine URL + username + password; server fetches the user's `api_key` via
  Basic Auth against `/users/current.json` and stores it locally in
  `%APPDATA%`. Manual updates via a shared folder + in-app version banner.
  Pulls "Phase B — Per-user Redmine keys" (below) forward without requiring
  the full SSO platform rework — scoped to per-user-localhost, team <20. See
  [`CHANGE_REQUESTS.md`](./CHANGE_REQUESTS.md#30) for full scope.
- **CR #21 — Dynamics/Dataverse CRM display** *(active near-term)*. A backend
  broker (`dynamicsClient.ts`, sibling to `redmineClient.ts`) authenticates to
  Dynamics 365 / Dataverse via the Azure AD **client-credentials flow**
  (service principal — app-to-app, independent of any per-user login), calls
  the Dataverse Web API (OData v4), and reshapes records into normalized types
  via adapters. Routes under `/api/dynamics/*`, TTL cache, read-only display.
  Surfaces CRM data as dashboard cards/sections.
  - **Live updates:** for "constantly updated," pair with a server-side refresh
    + push to clients over **SSE** (same transport scoped for the metrics work).
    A lightweight TTL poll is the simpler interim option.
  - **Prereqs you supply:** Dataverse environment URL; an Entra ID app
    registration (tenant ID, client ID, client secret → `.env.local`); a
    Dataverse **Application User** tied to that app with a security role
    granting **read** on the target tables.
  - **Open scope:** which tables/columns (accounts, contacts, opportunities,
    custom table?) and where they render.

## On hold

- **CR #20 — Custom (manually-entered) metrics.** Originally scoped as
  admin-editable, SSE-broadcast metrics. **On hold** — it was a placeholder for
  the data we now intend to pull from the CRM (CR #21), so it's superseded for
  that purpose. Revisit only if some metrics genuinely need **manual entry**
  (not CRM-sourced). The server-side store + SSE broadcaster designed for it
  are reusable infrastructure for CR #21's live updates.

## Later — platform evolution (deferred "big implementation")

The "host for the whole team, each with their own Redmine key, managers as
admins" track. An epic, sequenced because each phase is the keystone for the
next. **Not building now** — this is the plan to pick up when you decide to go
multi-user. Today's single-team usage keeps working untouched until then.

- **Phase A — Auth foundation (the keystone).** Replace the single hardcoded
  admin with **Entra ID (Azure AD) SSO** + a real user/session model.
  Everything below depends on this.
- **Phase B — Per-user Redmine keys.** Re-introduce key entry (securely), store
  each user's key **encrypted at rest**, and inject *their* key per request
  instead of the shared one. (Note: the per-user key input was deliberately
  removed earlier for security — this re-adds it the right way.) *Depends on A.*
- **Phase C — RBAC.** Roles (user vs manager/admin); map an Entra **group →
  admin** so managers are admins automatically; gate admin features behind it.
  *Depends on A.*
- **Phase D — Production hardening.** Move sessions / rate-limit / cache / SSE
  fan-out to **Redis** (partly supported via `REDIS_URL`), and graduate
  per-user data + keys from the JSONL file store to a real **DB
  (SQLite/Postgres)**. *Depends on A–C.*
- **Phase E — Constantly-updated CRM at scale.** A **scheduled server-side
  sync** into a cache that pushes via SSE, so many viewers stay current without
  every browser hitting Dynamics directly. *Builds on CR #21 + Phase D.*
- **Phase F — Deployment.** Reverse proxy, HTTPS, `COOKIE_SECURE=true`, secrets
  management, ops runbook. *Final step.*

## Sequencing logic

- The **Now** work (CR #21) ships independently and doesn't touch auth, so
  current single-team usage is never blocked.
- The **Later** track begins only when you choose to go multi-user, and
  **Phase A (SSO) gates everything else** — it's the first thing built when
  that day comes.
- Non-code blockers for the deferred track are decisions/credentials you'd
  supply: Entra tenant + app registration, infra for Redis/DB, and the hosting
  target.
