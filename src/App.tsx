import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppShell from './components/AppShell';
import RequireAdmin from './components/RequireAdmin';
import Dashboard from './pages/Dashboard';
import MyTasks from './pages/MyTasks';
import Tasks from './pages/Tasks';
import PastDue from './pages/PastDue';
import TimeTracking from './pages/TimeTracking';
import ResourceManagement from './pages/ResourceManagement';
import ProjectBuilder from './pages/ProjectBuilder';
import Directory from './pages/Directory';
import Settings from './pages/Settings';
import Home from './pages/Home';
import Projects from './pages/Projects';
import AllProjects from './pages/AllProjects';
import ProjectCategory from './pages/ProjectCategory';
import Reports from './pages/Reports';
import Calendar from './pages/Calendar';
import Hours from './pages/Hours';
// MyHours / TeamHours are orphaned by the Hours redesign; legacy URLs
// redirect to /hours below. Files stay (deletion in Phase 4 cleanup).
import Login from './pages/Login';
import Admin from './pages/Admin';

export default function App() {
  const location = useLocation();
  // /login renders standalone (no AppShell sidebar/topbar).
  if (location.pathname === '/login') {
    return <Login />;
  }

  return (
    <AppShell>
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

        <Route path="/past-due" element={<PastDue />} />

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
        <Route path="/reports" element={<Reports />} />
        <Route path="/directory" element={<Directory />} />
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
