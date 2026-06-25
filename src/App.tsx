import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppShell from './components/AppShell';
import RequireAdmin from './components/RequireAdmin';
import Dashboard from './pages/Dashboard';
import MyTasks from './pages/MyTasks';
import Tasks from './pages/Tasks';
import TimeTracking from './pages/TimeTracking';
import Timesheet from './pages/Timesheet';
import ResourceManagement from './pages/ResourceManagement';
import ProjectBuilder from './pages/ProjectBuilder';
import Settings from './pages/Settings';
import Home from './pages/Home';
import Projects from './pages/Projects';
import AllProjects from './pages/AllProjects';
import ProjectCategory from './pages/ProjectCategory';
import PowerBiReport from './pages/PowerBiReport';
import Calendar from './pages/Calendar';
import Hours from './pages/Hours';
// MyHours / TeamHours are orphaned by the Hours redesign; legacy URLs
// redirect to /hours below. Files stay (deletion in Phase 4 cleanup).
import Login from './pages/Login';
import PortableLogin from './pages/PortableLogin';
import Admin from './pages/Admin';
import { usePortableGate } from './hooks/usePortableGate';

// One-shot: the default team selection grew from 6 to 12 engineers (and
// 'svillasenor' was corrected to 'nvillasenor'). Anyone whose browser
// still has the prior 6-engineer selection saved gets it cleared once so
// the new default picks up on next render. Safe to delete after every
// active user has hit the app at least once post-migration.
const TEAM_SELECTION_MIGRATION_KEY = 'rod.team.selection.migration.v2';

function clearLegacyTeamSelection(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(TEAM_SELECTION_MIGRATION_KEY) === 'done') return;
    localStorage.removeItem('rod.team.selectedUserIds');
    localStorage.setItem(TEAM_SELECTION_MIGRATION_KEY, 'done');
  } catch {
    // privacy mode / storage disabled — ignore
  }
}

export default function App() {
  useEffect(clearLegacyTeamSelection, []);

  const gate = usePortableGate();
  const location = useLocation();

  // CR #30: portable .exe runs single-user. While we're still resolving
  // /health + /api/portable/status, render nothing (very brief, single
  // network round-trip) so we don't flash the centralized app shell.
  if (gate.state === 'checking') {
    return null;
  }
  // Portable mode + no per-user config on disk yet → first-run login.
  if (gate.state === 'login-required') {
    return <PortableLogin onLoggedIn={gate.markReady} />;
  }

  // /login renders standalone (no AppShell sidebar/topbar). Centralized
  // mode only — there is no admin session in portable mode.
  if (!gate.portable && location.pathname === '/login') {
    return <Login />;
  }

  return (
    <AppShell portable={gate.portable} version={gate.version}>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Tasks — `/tasks` is the new combined My + Team view.
            `/my-tasks` is kept as a legacy redirect for any bookmarks. */}
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/my-tasks" element={<MyTasks />} />

        <Route path="/calendar" element={<Calendar />} />

        {/* Hours — single page; legacy leaves redirect. */}
        <Route path="/hours" element={<Hours />} />
        <Route path="/hours/me" element={<Navigate to="/hours" replace />} />
        <Route path="/hours/team" element={<Navigate to="/hours" replace />} />

        {/* Turned off for now — redirect to home. */}
        <Route path="/past-due" element={<Navigate to="/home" replace />} />
        <Route path="/directory" element={<Navigate to="/home" replace />} />
        <Route path="/reports" element={<Navigate to="/home" replace />} />

        {/* Projects — `/projects` = category dashboard, `/projects/all` = browse all,
            `/projects/category/:slug` = drill-down into one category (CR #15) */}
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/all" element={<AllProjects />} />
        {/* Alias the legacy `stc` slug to the canonical `stcs`. */}
        <Route
          path="/projects/category/stc"
          element={<Navigate to="/projects/category/stcs" replace />}
        />
        <Route path="/projects/category/:slug" element={<ProjectCategory />} />

        <Route path="/project-builder" element={<ProjectBuilder />} />
        {/* /resources is the new full reorderable view; /resources/personal
            and /resources/team remain as legacy single-section routes for
            anyone deep-linking to one view. */}
        <Route path="/resources" element={<ResourceManagement />} />
        <Route path="/resources/personal" element={<ResourceManagement view="personal" />} />
        <Route path="/resources/team" element={<ResourceManagement view="team" />} />
        <Route path="/time" element={<TimeTracking />} />
        <Route path="/timesheet" element={<Timesheet />} />
        <Route path="/reports/power-bi" element={<PowerBiReport />} />
        <Route path="/settings" element={<Settings />} />

        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <Admin />
            </RequireAdmin>
          }
        />

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </AppShell>
  );
}
