# Redmine Operations Dashboard

A modern enterprise dashboard UI for Redmine, inspired by ServiceNow-style operations workspaces and the Studio-style app launcher. Brand color is `#FEDF00` (bright yellow) on the header and sidebar, with a clean light-canvas main area.

This repository contains the **base UI** with mock data and API placeholder functions. The application is ready to be wired up to a real Redmine REST API later.

**Live demo:** https://nbraithwaite26.github.io/redmine-ops-dashboard/

**More docs:**
- [CHANGELOG.md](./CHANGELOG.md) — every change in this and future releases
- [docs/FEATURES.md](./docs/FEATURES.md) — feature checklist for every page and component
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — code layout, data flow, integration plan
- [docs/API.md](./docs/API.md) — mock API reference + suggested Redmine REST mapping
- [docs/CHANGE_REQUESTS.md](./docs/CHANGE_REQUESTS.md) — running log of requested UI changes (collected, not yet implemented)

## Features

- App shell with yellow `#FEDF00` top bar and slim left sidebar
- Secondary searchable workspace navigation
- Operations-style dashboard with metric cards, donuts, tabs, and right-side utility panel
- Reusable issue table with search, sort, bulk select, quick edit, and row drawer
- Quick Edit popup for fast status/priority/assignee/time updates
- Slide-out Ticket Editor drawer with full field set
- Past Due tasks view with overdue highlighting
- Time Tracking page with summary cards and add/edit/delete entries
- Resource Management page with a Gantt-style allocation timeline
- Project Builder for assembling project + task hierarchy before pushing to Redmine
- Directory page mirroring the Studio-style grouped app list
- API Settings page for Redmine connection (base URL, API key, mock mode toggle)
- Mock Redmine API service with placeholder functions for every action the UI calls
- Vitest + React Testing Library tests covering key interactions
- GitHub Actions CI for typecheck + lint + tests + build, and a GH Pages deploy workflow

## Getting started

```bash
npm install
npm run dev
```

The app will be available at http://localhost:5173.

### Other scripts

| Command | Description |
| --- | --- |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run typecheck` | TypeScript type check (no emit) |
| `npm run lint` | ESLint |

## Project structure

```
src/
  App.tsx                    Router and top-level layout
  main.tsx                   Entry point
  index.css                  Tailwind base + component classes
  components/
    AppShell.tsx             Shell wrapper (TopBar + Sidebar + SecondaryNav + RightPanel)
    TopBar.tsx               Yellow #FEDF00 top bar with search, sync, profile
    Sidebar.tsx              Slim yellow vertical icon sidebar
    SecondaryNav.tsx         Searchable workspace list
    RightPanel.tsx           Announcements, Upcoming, Quick links, Recent activity
    DashboardCard.tsx        Reusable metric card with three-dot menu and visual
    DonutChart.tsx           SVG donut chart
    IssueTable.tsx           Reusable issue table (search, sort, bulk select, actions)
    QuickEditPopup.tsx       Fast ticket edit popup with optional time-log
    TicketDrawer.tsx         Full ticket editor drawer
    ResourceTimeline.tsx     Gantt-style allocation timeline
  pages/
    Home.tsx                 Studio-style welcome + recently opened + tools
    Dashboard.tsx            Operations overview with metric cards + My Tasks
    MyTasks.tsx              Personal issue queue
    PastDue.tsx              Overdue tasks
    Projects.tsx             Project portfolio
    ProjectBuilder.tsx       Project + task hierarchy composer
    ResourceManagement.tsx   Allocation Gantt view
    TimeTracking.tsx         Time entries with grouping
    Reports.tsx              Reports landing
    Directory.tsx            Grouped internal links and projects
    Settings.tsx             Redmine API connection settings
  data/mockData.ts           Mock users, projects, issues, time entries, allocations, links
  services/redmineApi.ts     Mock Redmine API service (real wiring goes here)
  types/redmine.ts           Domain types
  lib/format.ts              Date / priority / status formatting helpers
  tests/                     Vitest + RTL tests
.github/workflows/
  ci.yml                     Typecheck + lint + test + build on every push/PR
  deploy.yml                 GitHub Pages deploy on push to main
```

## Mock data

All names and emails in mock data are intentionally generic (`alex.morgan@example.com`, etc.). The UI references project names like "Aircraft Retrofit Planning" and "Customer Support Requests" as illustrative placeholders — no real internal data is included.

## Wiring up Redmine

When you're ready to connect a real Redmine instance:

1. Set base URL and API key on the **Settings** page (or via `VITE_REDMINE_BASE_URL` / `VITE_REDMINE_API_KEY` env vars).
2. Replace the mock implementations inside `src/services/redmineApi.ts` with real `fetch` calls — function signatures are designed to stay the same.
3. **Do not** call Redmine directly from the browser with the API key. Add a thin backend service (or a serverless function) that injects the `X-Redmine-API-Key` header, so the key never reaches the client and CORS isn't a problem.

## Deployment (GitHub Pages)

This repo includes a `Deploy to GitHub Pages` workflow at `.github/workflows/deploy.yml`. After enabling Pages in repo settings (Source: GitHub Actions), every push to `main` builds and deploys.

The Vite config sets `base` to `/redmine-ops-dashboard/`. If you fork or rename the repo, override with `VITE_BASE=/new-name/`.

> **GitHub Pages on private repos** requires GitHub Pro, Team, or Enterprise. If Pages refuses to publish, either make the repo public or use Vercel/Netlify instead — they accept the same `dist/` output.

## Suggested commit plan

This repo was scaffolded with a logical commit history:

1. Initial project scaffold (Vite + React + TypeScript + Tailwind)
2. Add domain types, mock data, and mock Redmine API service
3. Add app shell layout (TopBar, Sidebar, SecondaryNav, RightPanel)
4. Add reusable dashboard components (DashboardCard, DonutChart, IssueTable)
5. Add Quick Edit popup and Ticket Editor drawer
6. Add resource timeline component
7. Add dashboard and core pages (Home, Dashboard, MyTasks, PastDue, Projects)
8. Add Time Tracking, Resource Management, Project Builder, Directory, Reports, Settings
9. Add tests for key interactions
10. Add CI workflow and GitHub Pages deploy workflow
11. Polish & README

## Tech stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- react-router-dom (hash router for static hosting)
- lucide-react for icons
- Vitest + React Testing Library for tests
- GitHub Actions for CI + Pages deploy
