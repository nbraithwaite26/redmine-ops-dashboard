import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import RightPanel from './RightPanel';
import Sidebar from './Sidebar';
import StatusBanner from './StatusBanner';
import TopBar from './TopBar';
import { useSidebarCollapse } from '../hooks/useSidebarCollapse';
import { useSyncBanner } from '../hooks/useSyncBanner';
import { useTheme } from '../hooks/useTheme';
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
  const { collapsed, toggle } = useSidebarCollapse();
  const { effectiveTheme, toggle: toggleTheme } = useTheme();

  // Keyboard shortcut: `]` toggles theme (pairs with `[` for sidebar).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== ']') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        return;
      }
      toggleTheme();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleTheme]);

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
    <div className="min-h-screen flex flex-col">
      {/* TopBar + StatusBanner stack at the very top of the document.
          The whole page scrolls naturally — sidebar and right panel are
          sticky so they remain visible alongside the scrolling main column.
          This eliminates the dead-space pattern that appeared when the row
          was forced to viewport height and main content was shorter than
          the right panel. */}
      <div className="sticky top-0 z-30">
        <TopBar
          apiConnected={apiConnected}
          mockMode={mockMode}
          isSyncing={isSyncing}
          onClickSync={handleSync}
          sidebarCollapsed={collapsed}
          onToggleSidebar={toggle}
          effectiveTheme={effectiveTheme}
          onToggleTheme={toggleTheme}
        />
        {banner && (
          <StatusBanner
            severity={banner.severity}
            message={banner.message}
            onDismiss={banner.onDismiss}
          />
        )}
      </div>
      <div className="flex flex-1 items-start">
        {/* Sticky sidebar — stays in view while main scrolls. */}
        <Sidebar collapsed={collapsed} onToggle={toggle} />
        <main className="flex-1 min-w-0">
          <div className="max-w-[1400px] mx-auto p-6">{children}</div>
        </main>
        {showRightPanel && <RightPanel />}
      </div>
    </div>
  );
}
