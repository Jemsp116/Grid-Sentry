import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

/**
 * App shell — fixed left sidebar (240px) + scrollable main content area.
 * Follows the Frontend Specification: dark SOC theme, accent-primary active state.
 */

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: '◈' },
  { to: '/alerts', label: 'Alert Feed', icon: '⚠' },
  { to: '/mitre', label: 'MITRE Matrix', icon: '🛡' },
  { to: '/logs', label: 'Log Explorer', icon: '☰' },
  { to: '/rules', label: 'Rules', icon: '⚙' },
  { to: '/blocklist', label: 'IP Blocklist', icon: '⊘' },
  { to: '/users', label: 'Users', icon: '👤' },
  { to: '/connected-sources', label: 'Connected Sources', icon: '🔌' },
  { to: '/settings/database', label: 'Database Settings', icon: '🗄' },
  { to: '/audit', label: 'Audit Log', icon: '📋' },
];

export default function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-full">
      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside className="flex w-60 flex-shrink-0 flex-col border-r border-border-default bg-bg-surface">
        {/* Branding */}
        <div className="flex items-center gap-2 border-b border-border-default px-5 py-4">
          <div className="h-7 w-1 rounded-full bg-accent-primary" />
          <h1 className="text-lg font-semibold text-text-primary">Grid Sentry</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded px-3 py-2.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-accent-primary/10 text-accent-primary font-medium'
                        : 'text-text-secondary hover:bg-bg-surface-raised hover:text-text-primary'
                    }`
                  }
                >
                  <span className="w-5 text-center text-base opacity-70">{item.icon}</span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* User info + sign out */}
        <div className="border-t border-border-default px-4 py-4">
          <p className="truncate text-xs text-text-secondary">
            Signed in as
          </p>
          <p className="truncate font-mono text-xs text-text-primary">{user?.email}</p>
          <p className="mb-3 text-[10px] uppercase tracking-widest text-accent-primary">
            {user?.role}
          </p>
          <button
            onClick={() => logout()}
            className="w-full rounded border border-border-default px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-surface-raised hover:text-text-primary"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1440px] p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
