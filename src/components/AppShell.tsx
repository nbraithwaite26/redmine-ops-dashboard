import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import RightPanel from './RightPanel';
import SecondaryNav from './SecondaryNav';
import Sidebar from './Sidebar';
import StatusBanner from './StatusBanner';
import TopBar from './TopBar';
import { useSyncBanner } from '../hooks/useSyncBanner';
import { getConnectionSettings, getCurrentUser, syncWithRedmine } from '../services/redmineApi';

const ROUTES_WITHOUT_RIGHT_PANEL = new Set(['/resources', '/resources/personal', '/resources/team', '/project-builder', '/settings']);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [apiConnected, setApiConnected] = useState(false);
  const [mockMode, setMockMode] = useState(true);
  const location = useLocation();
  const { banner, status, beginSync, reportSuccess, reportError } = useSyncBanner({
    mockMode,
  });
  const isSyncing = status.kind === 'syncing';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settings = await getConnectionSettings();
      if (cancelled) return;
      setMockMode(settings.mockMode);
      if (settings.mockMode) {
        await getCurrentUser();
        setApiConnected(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSync = async () => {
    beginSync();
    try {
      await syncWithRedmine();
      reportSuccess();
    } catch (err) {
      reportError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const showRightPanel = !ROUTES_WITHOUT_RIGHT_PANEL.has(location.pathname);

  return (
    <div className="h-full flex flex-col">
      <TopBar
        apiConnected={apiConnected}
        mockMode={mockMode}
        isSyncing={isSyncing}
        onClickSync={handleSync}
      />
      {banner && (
        <StatusBanner
          severity={banner.severity}
          message={banner.message}
          onDismiss={banner.onDismiss}
        />
      )}
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
