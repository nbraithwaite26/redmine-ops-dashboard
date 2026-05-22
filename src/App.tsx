import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
import MyTasks from './pages/MyTasks';
import PastDue from './pages/PastDue';
import TimeTracking from './pages/TimeTracking';
import ResourceManagement from './pages/ResourceManagement';
import ProjectBuilder from './pages/ProjectBuilder';
import Directory from './pages/Directory';
import Settings from './pages/Settings';
import Home from './pages/Home';
import Projects from './pages/Projects';
import Reports from './pages/Reports';

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/my-tasks" element={<MyTasks />} />
        <Route path="/past-due" element={<PastDue />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/project-builder" element={<ProjectBuilder />} />
        <Route path="/resources" element={<Navigate to="/resources/personal" replace />} />
        <Route path="/resources/personal" element={<ResourceManagement view="personal" />} />
        <Route path="/resources/team" element={<ResourceManagement view="team" />} />
        <Route path="/time" element={<TimeTracking />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </AppShell>
  );
}
