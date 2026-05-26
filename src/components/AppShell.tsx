import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import RightPanel from './RightPanel';
import Sidebar from './Sidebar';
import StatusBanner from './StatusBanner';
import TopBar from './TopBar';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useSidebarCollapse } from '../hooks/useSidebarCollapse';
import { useSyncBanner } from '../hooks/useSyncBanner';
import { useTheme } from '../hooks/useTheme';
import { useReadOnly } from '../hooks/useReadOnly';
import { getConnectionSettings, getCurrentUser, syncWithRedmine } from '../services/redmineApi';
import { postSyncEvent } from '../services/adminApi';

const ROUTES_WITHOUT_RIGHT_PANEL = new Set(['/resources', '/resources/personal', '/resources/team', '/project-builder', '/settings']);

const LAST_SYNC_KEY = 'redmine-ops:last-sync-at';

function readLastSync(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(LAST_SYNC_KEY);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeLastSync(at: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_SYNC_KEY, String(at));
  } catch {
    /* ignore quota */
  }
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [apiConnected, setApiConnected] = useState(false);
  const [mockMode, setMockMode] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(readLastSync);
  const { readOnly } = useReadOnly();
  const location = useLocation();
  const { banner, status, beginSync, reportSuccess, reportError } = useSyncBanner({
    mockMode,
  });
  const isSyncing = status.kind === 'syncing';
  const { collapsed, toggle, setCollapsed } = useSidebarCollapse();
  const { effectiveTheme, toggle: toggleTheme } = useTheme();
  // `md` breakpoint in Tailwind is 768px — below it the sidebar floats
  // over content as an overlay rather than pushing the main column.
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const showMobileBackdrop = !isDesktop && !collapsed;

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
    const startedAt = Date.now();
    try {
      await syncWithRedmine();
      const now = Date.now();
      setLastSyncAt(now);
      writeLastSync(now);
      reportSuccess();
      // Best-effort audit record. Mock mode short-circuits to ok in adminApi.
      void postSyncEvent({
        trigger: 'manual',
        status: 'success',
        durationMs: now - startedAt,
      }).catch(() => {
        /* sync-events recording is best-effort */
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      reportError(message);
      void postSyncEvent({
        trigger: 'manual',
        status: 'error',
        durationMs: Date.now() - startedAt,
        errorMessage: message,
      }).catch(() => {
        /* sync-events recording is best-effort */
      });
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
          readOnly={readOnly}
          isSyncing={isSyncing}
          lastSyncAt={lastSyncAt}
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
        {/* Sidebar — sticky-push on desktop, fixed/overlay below `md`. */}
        <Sidebar collapsed={collapsed} onToggle={toggle} />
        {showMobileBackdrop && (
          <button
            type="button"
            aria-label="Close sidebar"
            data-testid="sidebar-backdrop"
            onClick={() => setCollapsed(true)}
            className="fixed inset-0 top-14 z-30 bg-black/30 md:hidden"
          />
        )}
        <main className="flex-1 min-w-0">
          <div className="max-w-[1400px] mx-auto p-4 md:p-6">{children}</div>
        </main>
        {showRightPanel && <RightPanel />}
      </div>
    </div>
  );
}
