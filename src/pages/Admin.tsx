import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, LogOut, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { useSession } from '../hooks/useSession';
import {
  getAdminHistory,
  getAdminPermissions,
  getAdminUsers,
  type AdminUsersResponse,
  type HistoryEvent,
  type HistoryKind,
  type HistoryResponse,
  type PermissionsResponse,
} from '../services/adminApi';

type Tab = 'users' | 'permissions' | 'history';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'users', label: 'Users' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'history', label: 'History' },
];

const PAGE_SIZE = 25;

function parseTab(raw: string | null): Tab {
  return raw === 'permissions' || raw === 'history' ? raw : 'users';
}

export default function Admin() {
  const session = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get('tab'));

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin</h1>
          <p className="text-sm text-ink-muted">
            Users, Permissions, and History — read-only.
          </p>
        </div>
        <button
          className="btn-secondary"
          onClick={() => void session.signOut()}
          data-testid="admin-sign-out"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>

      <section className="card p-4" data-testid="admin-session-card">
        <div className="flex items-center gap-2 text-sm">
          <ShieldCheck size={16} className="text-green-700" />
          <span>
            Signed in as{' '}
            <strong className="text-ink">{session.user ?? '—'}</strong>
            {session.mock && (
              <span className="ml-2 pill-yellow text-xs">Mock session</span>
            )}
          </span>
        </div>
      </section>

      <div
        role="tablist"
        aria-label="Admin views"
        className="flex items-center gap-2 border-b border-gray-200"
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          const idx = TABS.findIndex((t) => t.id === activeTab);
          const dir = e.key === 'ArrowLeft' ? -1 : 1;
          const next = TABS[(idx + dir + TABS.length) % TABS.length];
          setTab(next.id);
          const target = e.currentTarget.querySelector(
            `[data-testid="tab-${next.id}"]`,
          ) as HTMLElement | null;
          target?.focus();
        }}
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            tabIndex={activeTab === id ? 0 : -1}
            data-testid={`tab-${id}`}
            onClick={() => setTab(id)}
            className={clsx(
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition',
              activeTab === id
                ? 'border-brand-500 text-ink'
                : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'permissions' && <PermissionsTab />}
      {activeTab === 'history' && <HistoryTab />}
    </div>
  );
}

// ─── Users tab ─────────────────────────────────────────────────────────────

function UsersTab() {
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAdminUsers({ limit: PAGE_SIZE, offset })
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [offset]);

  if (loading && !data) {
    return (
      <p className="text-sm text-ink-muted" data-testid="users-loading">
        Loading users…
      </p>
    );
  }
  if (error) return <ErrorBanner error={error} />;
  if (!data) return null;

  if (data.degraded) {
    return (
      <div className="card p-4" data-testid="users-degraded">
        <div className="flex items-start gap-2 text-sm">
          <AlertCircle size={16} className="mt-0.5 text-amber-700" />
          <div>
            <p className="font-medium">Users endpoint unavailable</p>
            <p className="text-xs text-ink-muted">{data.degradedReason}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="panel-users">
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Login</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Groups</th>
              <th className="px-3 py-2 font-medium">Roles</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((u) => (
              <tr key={u.id} className="border-t border-gray-100">
                <td className="px-3 py-2">{u.name}</td>
                <td className="px-3 py-2 text-ink-muted">{u.login}</td>
                <td className="px-3 py-2 text-ink-muted">{u.email}</td>
                <td className="px-3 py-2">
                  <span
                    className={clsx(
                      'px-2 py-0.5 rounded text-xs',
                      u.status === 'Active'
                        ? 'bg-green-50 text-green-800'
                        : 'bg-gray-100 text-ink-muted',
                    )}
                  >
                    {u.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-ink-muted">
                  {u.groups.join(', ') || '—'}
                </td>
                <td className="px-3 py-2 text-ink-muted">
                  {u.roles.join(', ') || '—'}
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-ink-muted"
                >
                  No users.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        total={data.total}
        limit={data.limit}
        offset={data.offset}
        onChange={setOffset}
      />
    </div>
  );
}

// ─── Permissions tab ───────────────────────────────────────────────────────

function PermissionsTab() {
  const [data, setData] = useState<PermissionsResponse | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAdminPermissions({ limit: PAGE_SIZE, offset })
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [offset]);

  if (loading && !data) {
    return (
      <p className="text-sm text-ink-muted" data-testid="permissions-loading">
        Loading permissions…
      </p>
    );
  }
  if (error) return <ErrorBanner error={error} />;
  if (!data) return null;

  return (
    <div className="space-y-3" data-testid="panel-permissions">
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">User</th>
              {data.projects.map((p) => (
                <th
                  key={p.id}
                  className="px-3 py-2 font-medium whitespace-nowrap"
                >
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.userId} className="border-t border-gray-100">
                <td className="px-3 py-2">{row.userName}</td>
                {data.projects.map((p) => {
                  const roles = row.byProjectRoles[p.id];
                  return (
                    <td key={p.id} className="px-3 py-2 text-xs text-ink-muted">
                      {roles && roles.length > 0 ? roles.join(', ') : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
            {data.rows.length === 0 && (
              <tr>
                <td
                  colSpan={data.projects.length + 1}
                  className="px-3 py-6 text-center text-ink-muted"
                >
                  No memberships visible.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        total={data.total}
        limit={data.limit}
        offset={data.offset}
        onChange={setOffset}
      />
    </div>
  );
}

// ─── History tab ───────────────────────────────────────────────────────────

function HistoryTab() {
  const [kind, setKind] = useState<HistoryKind>('all');
  const [status, setStatus] = useState<string>('');
  const [since, setSince] = useState<string>('');
  const [until, setUntil] = useState<string>('');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAdminHistory({
      kind,
      status: status || undefined,
      since: since || undefined,
      until: until || undefined,
      limit: PAGE_SIZE,
      offset,
    })
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, status, since, until, offset]);

  // Any filter change resets paging back to page 1.
  const apply = useCallback(<T,>(setter: (v: T) => void, value: T) => {
    setOffset(0);
    setter(value);
  }, []);

  return (
    <div className="space-y-3" data-testid="panel-history">
      <div className="card p-3 flex flex-wrap items-end gap-3">
        <label className="text-xs space-y-1">
          <span className="block text-ink-muted">Kind</span>
          <select
            className="input"
            data-testid="history-kind"
            value={kind}
            onChange={(e) => apply(setKind, e.target.value as HistoryKind)}
          >
            <option value="all">All</option>
            <option value="sync">Sync</option>
            <option value="login">Login</option>
          </select>
        </label>
        <label className="text-xs space-y-1">
          <span className="block text-ink-muted">Status</span>
          <input
            className="input"
            data-testid="history-status"
            value={status}
            placeholder="e.g. success, error"
            onChange={(e) => apply(setStatus, e.target.value)}
          />
        </label>
        <label className="text-xs space-y-1">
          <span className="block text-ink-muted">Since</span>
          <input
            type="date"
            className="input"
            data-testid="history-since"
            value={since}
            onChange={(e) => apply(setSince, e.target.value)}
          />
        </label>
        <label className="text-xs space-y-1">
          <span className="block text-ink-muted">Until</span>
          <input
            type="date"
            className="input"
            data-testid="history-until"
            value={until}
            onChange={(e) => apply(setUntil, e.target.value)}
          />
        </label>
      </div>

      {loading && !data ? (
        <p className="text-sm text-ink-muted" data-testid="history-loading">
          Loading history…
        </p>
      ) : error ? (
        <ErrorBanner error={error} />
      ) : data ? (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Kind</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Detail</th>
                  <th className="px-3 py-2 font-medium">Request ID</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((ev) => (
                  <tr
                    key={`${ev.kind}-${ev.id}`}
                    className="border-t border-gray-100"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(ev.at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <span className="pill-yellow text-xs">{ev.kind}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">{ev.status}</td>
                    <td className="px-3 py-2 text-xs text-ink-muted">
                      {historyDetail(ev)}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-muted font-mono">
                      {ev.requestId || '—'}
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-ink-muted"
                    >
                      No events.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            total={data.total}
            limit={data.limit}
            offset={data.offset}
            onChange={setOffset}
          />
        </>
      ) : null}
    </div>
  );
}

function historyDetail(ev: HistoryEvent): string {
  if (ev.kind === 'sync') {
    const parts = [ev.actor ?? '—', ev.trigger ?? '—'];
    if (typeof ev.durationMs === 'number') parts.push(`${ev.durationMs}ms`);
    if (ev.errorMessage) parts.push(ev.errorMessage);
    return parts.join(' · ');
  }
  return [ev.user ?? '—', ev.sourceIp].filter(Boolean).join(' · ');
}

// ─── Shared helpers ────────────────────────────────────────────────────────

function Pagination({
  total,
  limit,
  offset,
  onChange,
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (next: number) => void;
}) {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const prev = () => onChange(Math.max(0, offset - limit));
  const next = () =>
    onChange(Math.min((totalPages - 1) * limit, offset + limit));
  return (
    <div className="flex items-center justify-between text-xs text-ink-muted">
      <span>
        Page {page} of {totalPages} · {total} total
      </span>
      <div className="flex gap-2">
        <button
          className="btn-secondary"
          disabled={offset === 0}
          onClick={prev}
          data-testid="page-prev"
        >
          Previous
        </button>
        <button
          className="btn-secondary"
          disabled={page >= totalPages}
          onClick={next}
          data-testid="page-next"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function ErrorBanner({ error }: { error: Error }) {
  return (
    <div className="card p-3 text-sm" data-testid="admin-error">
      <div className="flex items-start gap-2">
        <AlertCircle size={14} className="mt-0.5 text-red-700" />
        <div>
          <p className="font-medium">Couldn't load data</p>
          <p className="text-xs text-ink-muted">{error.message}</p>
        </div>
      </div>
    </div>
  );
}
