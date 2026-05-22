import {
  Bell,
  ChevronDown,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  User,
} from 'lucide-react';

interface Props {
  apiConnected: boolean;
  mockMode: boolean;
  isSyncing: boolean;
  onClickSync: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export default function TopBar({
  apiConnected,
  mockMode,
  isSyncing,
  onClickSync,
  sidebarCollapsed,
  onToggleSidebar,
}: Props) {
  return (
    <header
      className="bg-brand text-ink h-14 flex items-center px-4 gap-4 border-b border-brand-500/40"
      role="banner"
    >
      <div className="flex items-center gap-2 min-w-[260px]">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          aria-pressed={sidebarCollapsed}
          title="Toggle sidebar ([)"
          className="p-1.5 rounded hover:bg-brand-500/30"
        >
          {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <div className="h-8 w-8 rounded bg-ink text-brand flex items-center justify-center font-bold">
          R
        </div>
        <div className="font-semibold tracking-tight">Redmine Operations Dashboard</div>
      </div>

      <nav className="flex items-center gap-1 text-sm font-medium">
        <button className="px-3 py-1.5 rounded hover:bg-brand-500/30">All</button>
        <button className="px-3 py-1.5 rounded hover:bg-brand-500/30">Favorites</button>
        <button className="px-3 py-1.5 rounded hover:bg-brand-500/30">History</button>
        <button className="px-3 py-1.5 rounded hover:bg-brand-500/30">Workspaces</button>
      </nav>

      <div className="flex-1 flex justify-center">
        <div className="bg-white/95 rounded-full px-3 py-1.5 flex items-center gap-2 w-[440px] max-w-full shadow-sm">
          <span className="px-2 py-0.5 rounded-full bg-brand-100 text-ink text-xs font-medium">
            Service Operations Workspace
          </span>
          <Search size={14} className="text-ink-muted" />
          <input
            className="bg-transparent outline-none text-sm flex-1 placeholder:text-ink-muted"
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
          className="btn bg-ink text-brand hover:bg-ink-soft disabled:opacity-70"
          aria-label="Sync with Redmine"
        >
          <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
          <span>{isSyncing ? 'Syncing…' : 'Sync with Redmine'}</span>
        </button>
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
        <button className="p-1.5 rounded hover:bg-brand-500/30" aria-label="Help">
          <HelpCircle size={18} />
        </button>
        <button className="p-1.5 rounded hover:bg-brand-500/30" aria-label="Notifications">
          <Bell size={18} />
        </button>
        <button className="p-1.5 rounded hover:bg-brand-500/30" aria-label="Settings">
          <SettingsIcon size={18} />
        </button>
        <button className="p-1 rounded-full hover:bg-brand-500/30" aria-label="User menu">
          <div className="h-8 w-8 rounded-full bg-ink text-brand flex items-center justify-center">
            <User size={16} />
          </div>
        </button>
      </div>
    </header>
  );
}
