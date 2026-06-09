# Change Requests

Active UI/backend changes the user has requested but not yet shipped. Shipped CRs are archived in [archive/CHANGE_REQUESTS_SHIPPED.md](./archive/CHANGE_REQUESTS_SHIPPED.md).

Status: 📥 collected · 📝 planned · 🛠 in progress · ✅ shipped (then archived).

---

## #34 — Multi-row Kanban (Dashboard › Resource Planning)

📥 Collected. The engineer-column Kanban on the Dashboard's Resource Planning
tab currently lays columns out in a single row via CSS Grid `auto-fit`. With a
large selected team, the row gets dense and each column is short. Extend the
layout so engineers can break across multiple rows — for example, group by
workspace/sub-team or simply wrap at N columns per row — and let each column
grow taller so the project cards inside breathe. Open question: do rows split
by sub-team (e.g. one row for Software, one for Hardware) or just wrap evenly?
Pairs with #31 perf work since denser rows benefit from windowed rendering.

## #33 — Outbound API keys for external programs

📥 Collected. Turn `/api/redmine/*` into a re-usable proxy authenticated by dashboard-issued keys, so scripts/Zapier/n8n send `Authorization: Bearer <dashboard-key>` and the backend forwards with the server-side upstream key. Hashed at rest, per-key `read`/`write` scopes, admin-gated mint/revoke UI, audit hooks reuse the existing history log. Pairs with #30 and #32. Open question: mirror `/api/v1/redmine/*` 1:1 or curate a smaller verb set (default: mirror).

## #32 — Project-from-template wizard (Easy Redmine `/templates`)

📥 Collected. This instance has 166 templates (curated engineering scaffolds + ~152 archived customer projects). Wire `GET /templates.json` and `POST /templates/:id/create.json` into a 3-step wizard inside `/project-builder`: pick template (curated tier first, search for the rest), fill in name/number/customer + dates_settings + parent, review/create, navigate to the new project. Discriminator: templates are regular `/projects/:id` records with `easy_is_easy_template: true`. Open question: which IDs go in the curated allow-list.

## #31 — First-paint + nav-cost speedups

📥 Collected. Builds on #29 (server cache). Stack-ranked work: (1) drop dead `getIssues()` walk on Home (~38 unused pages), (2) add `getIssueCount()` that reads `total_count` from the wire envelope instead of `.length` on paginated results, (3) parallelize `paginateAll` with concurrency 4–6, (4) in-memory frontend GET cache + `Cache-Control`/`ETag` on backend list/detail GETs, (5) route-level `React.lazy()` splitting (Home no longer bundles framer-motion / TeamWorkPanel / charts), (6) retarget the warmer to count-only after step 2 lands. Expected Home cold load drops by the cost of the dead walk; repeat-nav near-instant.

## #30 — Portable per-user desktop build (Windows .exe)

📥 Collected. Each teammate runs a Bun-compiled .exe on their own PC. First launch prompts for Redmine URL + username + password; server hits `/users/current.json` via Basic Auth, stores the returned `api_key` in `%APPDATA%\redmine-ops-dashboard\config.json`. Hono serves the SPA from `dist/`, `PORTABLE=true` flag disables admin/session/audit stack. Manual updates via shared folder + in-app version banner pulling a `version.json`. Target team size <20. Realizes "Phase B — per-user Redmine keys" from [ROADMAP.md](./ROADMAP.md) without the full SSO prerequisite.

---

For the full original scope of any active CR above (acceptance criteria, file lists, phased breakdowns, open questions), see the version-control history of this file before the docs thinning pass — the originals are preserved verbatim in commits prior to the trim.
