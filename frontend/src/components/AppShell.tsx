import { NavLink, Outlet } from 'react-router-dom';
import { useAuth, type Role } from '../context/AuthContext.js';
import { SourceProvider } from '../context/SourceContext.js';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles: Role[];
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'OPERATIONS',
    items: [
      { to: '/', label: 'Overview', icon: '◈', roles: ['viewer', 'analyst', 'admin'] },
      { to: '/alerts', label: 'Alert Feed', icon: '⚠', roles: ['viewer', 'analyst', 'admin'] },
      { to: '/mitre', label: 'MITRE Matrix', icon: '🛡', roles: ['viewer', 'analyst', 'admin'] },
      { to: '/logs', label: 'Log Explorer', icon: '☰', roles: ['viewer', 'analyst', 'admin'] },
    ],
  },
  {
    title: 'TRIAGE & DEFENSE',
    items: [
      { to: '/blocklist', label: 'IP Blocklist', icon: '⊘', roles: ['analyst', 'admin'] },
    ],
  },
  {
    title: 'ADMINISTRATION',
    items: [
      { to: '/rules', label: 'Detection Rules', icon: '⚙', roles: ['admin'] },
      { to: '/users', label: 'Team & Org', icon: '👤', roles: ['admin'] },
      { to: '/connected-sources', label: 'Connected Sources', icon: '🔌', roles: ['admin'] },
      { to: '/settings/database', label: 'Database Settings', icon: '🗄', roles: ['admin'] },
      { to: '/audit', label: 'Audit Log', icon: '📋', roles: ['admin'] },
    ],
  },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const currentRole: Role = user?.role ?? 'viewer';

  // Filter sections and items based on active user role
  const visibleSections = NAV_SECTIONS.map((sec) => ({
    ...sec,
    items: sec.items.filter((item) => item.roles.includes(currentRole)),
  })).filter((sec) => sec.items.length > 0);

  return (
    <div className="flex h-full">
      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-border-default bg-bg-surface">
        {/* Branding */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-1 rounded-full bg-accent-primary" />
            <h1 className="text-lg font-semibold text-text-primary">Grid Sentry</h1>
          </div>
          <span className="rounded bg-bg-surface-raised px-2 py-0.5 text-[10px] font-mono font-medium text-text-secondary border border-border-default">
            SOC
          </span>
        </div>

        {/* Role-filtered Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {visibleSections.map((sec) => (
            <div key={sec.title}>
              <div className="px-3 pb-1.5 text-[10px] font-mono font-semibold tracking-wider text-text-disabled uppercase">
                {sec.title}
              </div>
              <ul className="space-y-1">
                {sec.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        `flex items-center justify-between rounded px-3 py-2 text-sm transition-colors ${
                          isActive
                            ? 'bg-accent-primary/15 text-accent-primary font-medium border-l-2 border-accent-primary'
                            : 'text-text-secondary hover:bg-bg-surface-raised hover:text-text-primary'
                        }`
                      }
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-center text-base opacity-70">{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="rounded bg-bg-surface px-1.5 py-0.5 text-[10px] font-mono text-text-disabled">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* User profile & Role badge */}
        <div className="border-t border-border-default bg-bg-base/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-text-primary">
                {user?.name || user?.email}
              </p>
              {user?.name && (
                <p className="truncate font-mono text-[11px] text-text-secondary">{user.email}</p>
              )}
              <div className="mt-1.5 flex items-center gap-1.5">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    user?.role === 'admin'
                      ? 'bg-severity-critical'
                      : user?.role === 'analyst'
                        ? 'bg-severity-high'
                        : 'bg-accent-primary'
                  }`}
                />
                <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-text-secondary">
                  {user?.role} Access
                </span>
                {user?.orgId && (
                  <span className="ml-auto rounded bg-bg-surface px-1.5 py-0.5 text-[9px] font-mono text-text-disabled border border-border-default">
                    ORG:{user.orgId.slice(-4)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="w-full rounded border border-border-default bg-bg-surface px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-surface-raised hover:text-text-primary hover:border-text-disabled"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1440px] p-6 lg:p-8">
          <SourceProvider>
            <Outlet />
          </SourceProvider>
        </div>
      </main>
    </div>
  );
}
