import { useState } from 'react';
import {
  Bell,
  ChevronDown,
  ClipboardList,
  HelpCircle,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  User,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import type { EffectiveTheme } from '../hooks/useTheme';

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
}: Props) {
  // Theme-aware logo. Light mode loads `public/logo.png`; dark mode loads
  // `public/logo-white.png`. Falls back to the ClipboardList badge if the
  // file for the active theme is missing.
  const logoFile = effectiveTheme === 'dark' ? 'logo-white.png' : 'logo.png';
  const logoSrc = `${import.meta.env.BASE_URL}${logoFile}`;
  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set());
  const logoFailed = failedLogos.has(logoFile);

  return (
    <header
      style={{
        backgroundColor: 'var(--brand-surface)',
        color: 'var(--brand-surface-text)',
      }}
      className="h-14 flex items-center px-4 gap-4 border-b border-brand-500/40"
      role="banner"
    >
      <div className="flex items-center gap-2 min-w-[260px]">
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
        <div className="font-semibold tracking-tight">Aircraft Engineering Redmine</div>
      </div>

      <nav className="flex items-center gap-1 text-sm font-medium">
        <button className="px-3 py-1.5 rounded transition hover:bg-[color:var(--brand-surface-hover)]">All</button>
        <button className="px-3 py-1.5 rounded transition hover:bg-[color:var(--brand-surface-hover)]">Favorites</button>
        <button className="px-3 py-1.5 rounded transition hover:bg-[color:var(--brand-surface-hover)]">History</button>
        <button className="px-3 py-1.5 rounded transition hover:bg-[color:var(--brand-surface-hover)]">Workspaces</button>
      </nav>

      <div className="flex-1 flex justify-center">
        <div className="bg-white/95 rounded-full px-3 py-1.5 flex items-center gap-2 w-[440px] max-w-full shadow-sm">
          <span className="px-2 py-0.5 rounded-full bg-brand-100 text-ink text-xs font-medium">
            Service Operations Workspace
          </span>
          <Search size={14} className="text-ink-muted" />
          <input
            className="bg-transparent outline-none text-sm flex-1 placeholder:text-ink-muted text-ink"
            placeholder="Search issues, projects, people…"
            aria-label="Global search"
          />
          <ChevronDown size={14} className="text-ink-muted" />
        </div>
      </div>

      <div className="flex items-center gap-2">
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
          <span>{isSyncing ? 'Syncing…' : 'Sync with Redmine'}</span>
        </button>
        {lastSyncAt !== null && (
          <span
            className="pill bg-white/20 text-xs"
            title={new Date(lastSyncAt).toLocaleString()}
            data-testid="last-sync-chip"
          >
            Last sync {formatRelativeTime(lastSyncAt)}
          </span>
        )}
        <span
          className={
            apiConnected
              ? 'pill bg-green-200 text-green-900'
              : mockMode
              ? 'pill bg-orange-200 text-orange-900'
              : 'pill bg-red-200 text-red-900'
          }
          title="API connection status"
        >
          {apiConnected ? 'Connected' : mockMode ? 'Mock mode' : 'Not connected'}
        </span>
        {readOnly && (
          <span
            className="pill bg-blue-200 text-blue-900 inline-flex items-center gap-1"
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
        <button className="p-1.5 rounded transition hover:bg-[color:var(--brand-surface-hover)]" aria-label="Help">
          <HelpCircle size={18} />
        </button>
        <button className="p-1.5 rounded transition hover:bg-[color:var(--brand-surface-hover)]" aria-label="Notifications">
          <Bell size={18} />
        </button>
        <button className="p-1.5 rounded transition hover:bg-[color:var(--brand-surface-hover)]" aria-label="Settings">
          <SettingsIcon size={18} />
        </button>
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
