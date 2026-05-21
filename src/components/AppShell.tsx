import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import RightPanel from './RightPanel';
import SecondaryNav from './SecondaryNav';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { getConnectionSettings, getCurrentUser } from '../services/redmineApi';

const ROUTES_WITHOUT_RIGHT_PANEL = new Set(['/resources', '/project-builder', '/settings']);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [apiConnected, setApiConnected] = useState(false);
  const [mockMode, setMockMode] = useState(true);
  const [, setLastSync] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settings = await getConnectionSettings();
      if (cancelled) return;
      setMockMode(settings.mockMode);
      if (settings.mockMode) {
        await getCurrentUser();
        setApiConnected(false); // Real API isn't connected; mock mode owns "connected" UX separately.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const showRightPanel = !ROUTES_WITHOUT_RIGHT_PANEL.has(location.pathname);

  return (
    <div className="h-full flex flex-col">
      <TopBar
        apiConnected={apiConnected}
        mockMode={mockMode}
        onSync={(t) => setLastSync(t)}
      />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <SecondaryNav />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto p-6">{children}</div>
        </main>
        {showRightPanel && <RightPanel />}
      </div>
    </div>
  );
}
