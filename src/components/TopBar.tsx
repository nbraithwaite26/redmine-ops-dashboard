import { useState } from 'react';
import {
  Bell,
  ChevronDown,
  ClipboardList,
  HelpCircle,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Power,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  User,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import type { EffectiveTheme } from '../hooks/useTheme';
import { useWorkspace } from '../hooks/useWorkspace';
import { portableShutdown } from '../services/portableAuth';

interface Props {
  apiConnected: boolean;
  mockMode: boolean;
  readOnly?: boolean;
  isSyncing: boolean;
  /** Epoch ms of the last successful sync, or null if none yet. */
  lastSyncAt?: number | null;
  onClickSync: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  effectiveTheme: EffectiveTheme;
  onToggleTheme: () => void;
  /** True when the backend is the portable single-user .exe (CR #30). */
  portable?: boolean;
  /** Build version reported by /api/redmine/health. Only shown in portable mode. */
  version?: string | null;
}

export default function TopBar({
  apiConnected,
  mockMode,
  readOnly = false,
  isSyncing,
  lastSyncAt = null,
  onClickSync,
  sidebarCollapsed,
  onToggleSidebar,
  effectiveTheme,
  onToggleTheme,
  portable = false,
  version = null,
}: Props) {
  const [quitting, setQuitting] = useState(false);
  async function handleQuit() {
    if (quitting) return;
    const ok = window.confirm(
      'Quit Redmine Ops Dashboard?\n\nThe local server will stop. You can reopen it by launching the app again.',
    );
    if (!ok) return;
    setQuitting(true);
    try {
      await portableShutdown();
    } catch {
      // Server may have died mid-response; that's fine — exit succeeded.
    }
    // Browser is now talking to a dead server. Leave the tab open so the
    // user has a moment to notice; many users just close it themselves.
  }
  // Theme-aware logo. Light mode loads `public/logo.png`; dark mode loads
  // `public/logo-white.png`. Falls back to the ClipboardList badge if the
  // file for the active theme is missing.
  const logoFile = effectiveTheme === 'dark' ? 'logo-white.png' : 'logo.png';
  const logoSrc = `${import.meta.env.BASE_URL}${logoFile}`;
  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set());
  const logoFailed = failedLogos.has(logoFile);

  const { workspace, workspaces } = useWorkspace();
  const workspaceLabel =
    workspaces.find((w) => w.id === workspace)?.label ?? 'Workspace';

  return (
    <header
      style={{
        backgroundColor: 'var(--brand-surface)',
        color: 'var(--brand-surface-text)',
      }}
      className="h-14 flex items-center px-3 md:px-4 gap-2 md:gap-4 border-b border-brand-500/40 overflow-x-hidden"
      role="banner"
    >
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          aria-pressed={sidebarCollapsed}
          title="Toggle sidebar ([)"
          className="p-1.5 rounded transition hover:bg-[color:var(--brand-surface-hover)]"
        >
          {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        {logoFailed ? (
          <div
            style={{
              backgroundColor: 'var(--brand-active-bg)',
              color: 'var(--brand-active-text)',
            }}
            className="h-8 w-8 rounded flex items-center justify-center font-bold"
            data-testid="logo-fallback"
          >
            <ClipboardList size={16} />
          </div>
        ) : (
          <img
            key={logoFile}
            src={logoSrc}
            alt="Aircraft Engineering Redmine logo"
            data-testid="logo-image"
            data-logo-variant={logoFile}
            className="h-8 w-8 object-contain rounded"
            onError={() =>
              setFailedLogos((prev) => {
                const next = new Set(prev);
                next.add(logoFile);
                return next;
              })
            }
          />
        )}
        <div className="font-semibold tracking-tight hidden sm:block truncate">Aircraft Engineering Redmine</div>
      </div>

      {/* Secondary nav — hidden on smaller screens to free horizontal space. */}
      <nav className="hidden lg:flex items-center gap-1 text-sm font-medium shrink-0">
        <button className="px-3 py-1.5 rounded transition hover:bg-[color:var(--brand-surface-hover)]">All</button>
        <button className="px-3 py-1.5 rounded transition hover:bg-[color:var(--brand-surface-hover)]">Favorites</button>
        <button className="px-3 py-1.5 rounded transition hover:bg-[color:var(--brand-surface-hover)]">History</button>
        <button className="px-3 py-1.5 rounded transition hover:bg-[color:var(--brand-surface-hover)]">Workspaces</button>
      </nav>

      <div className="flex-1 flex justify-center min-w-0">
        <div className="bg-white/95 rounded-full px-3 py-1.5 flex items-center gap-2 w-full max-w-[440px] min-w-0 shadow-sm">
          {/*
            The search bar's outer container is always white (`bg-white/95`)
            regardless of theme, so the pill sits on a light surface in BOTH
            modes. Earlier we used `text-ink` which becomes near-white in dark
            mode → invisible on the brand-yellow pill. Pin the text color to
            the brand's dark-on-yellow value (#1F2937) explicitly so the pill
            stays legible no matter what.
          */}
          <span
            className="hidden md:inline-block px-2 py-0.5 rounded-full bg-brand-100 text-xs font-medium whitespace-nowrap"
            style={{ color: '#1f2937' }}
            data-testid="topbar-workspace-pill"
            title={workspaceLabel}
          >
            {workspaceLabel}
          </span>
          <Search size={14} className="text-ink-muted shrink-0" />
          <input
            className="bg-transparent outline-none text-sm flex-1 min-w-0 placeholder:text-ink-muted text-ink"
            placeholder="Search issues, projects, people…"
            aria-label="Global search"
          />
          <ChevronDown size={14} className="text-ink-muted shrink-0 hidden md:block" />
        </div>
      </div>

      <div className="flex items-center gap-1 md:gap-2 shrink-0">
        <button
          onClick={onClickSync}
          disabled={isSyncing}
          style={{
            backgroundColor: 'var(--brand-active-bg)',
            color: 'var(--brand-active-text)',
          }}
          className="btn disabled:opacity-70 hover:opacity-90"
          aria-label="Sync with Redmine"
        >
          <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">{isSyncing ? 'Syncing…' : 'Sync with Redmine'}</span>
        </button>
        {lastSyncAt !== null && (
          <span
            className="pill bg-white/20 text-xs hidden lg:inline-flex"
            title={new Date(lastSyncAt).toLocaleString()}
            data-testid="last-sync-chip"
          >
            Last sync {formatRelativeTime(lastSyncAt)}
          </span>
        )}
        <span
          className={
            'hidden md:inline-flex ' +
            (apiConnected
              ? 'pill bg-green-200 text-green-900'
              : mockMode
              ? 'pill bg-orange-200 text-orange-900'
              : 'pill bg-red-200 text-red-900')
          }
          title="API connection status"
        >
          {apiConnected ? 'Connected' : mockMode ? 'Mock mode' : 'Not connected'}
        </span>
        {readOnly && (
          <span
            className="pill bg-blue-200 text-blue-900 hidden md:inline-flex items-center gap-1"
            title="Backend is in read-only mode — writes are disabled."
            data-testid="read-only-badge"
          >
            <Lock size={12} /> Read-only
          </span>
        )}
        <ThemeToggle
          effectiveTheme={effectiveTheme}
          onToggle={onToggleTheme}
          className="p-1.5 rounded transition hover:bg-[color:var(--brand-surface-hover)]"
        />
        <button className="hidden lg:inline-flex p-1.5 rounded transition hover:bg-[color:var(--brand-surface-hover)]" aria-label="Help">
          <HelpCircle size={18} />
        </button>
        <button className="hidden lg:inline-flex p-1.5 rounded transition hover:bg-[color:var(--brand-surface-hover)]" aria-label="Notifications">
          <Bell size={18} />
        </button>
        <button className="hidden lg:inline-flex p-1.5 rounded transition hover:bg-[color:var(--brand-surface-hover)]" aria-label="Settings">
          <SettingsIcon size={18} />
        </button>
        {portable && version && (
          <span
            className="hidden md:inline-flex items-center rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-medium text-white/80"
            title={`Portable build ${version}`}
            data-testid="topbar-version"
          >
            v{version}
          </span>
        )}
        {portable && (
          <button
            type="button"
            onClick={handleQuit}
            disabled={quitting}
            aria-label="Quit Redmine Ops Dashboard"
            title="Quit Redmine Ops Dashboard"
            data-testid="topbar-quit"
            className="hidden md:inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-200 transition hover:bg-red-500/20 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Power size={14} />
            {quitting ? 'Quitting…' : 'Quit'}
          </button>
        )}
        <button className="p-1 rounded-full transition hover:bg-[color:var(--brand-surface-hover)]" aria-label="User menu">
          <div
            style={{
              backgroundColor: 'var(--brand-active-bg)',
              color: 'var(--brand-active-text)',
            }}
            className="h-8 w-8 rounded-full flex items-center justify-center"
          >
            <User size={16} />
          </div>
        </button>
      </div>
    </header>
  );
}

function formatRelativeTime(at: number): string {
  const delta = Date.now() - at;
  if (delta < 60_000) return 'just now';
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
