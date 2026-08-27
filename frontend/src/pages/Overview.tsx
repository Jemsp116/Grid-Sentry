import { useEffect, useState } from 'react';
import { useAuth, type Role } from '../context/AuthContext.js';

interface HealthResponse {
  status: string;
  dependencies: { postgres: boolean; opensearch: boolean };
  time: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

// Probes that exercise the RBAC matrix (TICKET-002) live from the browser.
const PROBES: { label: string; path: string; method?: string; minRole: Role }[] = [
  { label: 'View alerts', path: '/alerts', minRole: 'viewer' },
  { label: 'Change alert status', path: '/alerts/1/status', method: 'PATCH', minRole: 'analyst' },
  { label: 'Manage rules', path: '/rules', minRole: 'admin' },
  { label: 'Manage users', path: '/users', minRole: 'admin' },
  { label: 'View audit log', path: '/audit', minRole: 'admin' },
];

const severityChips: { label: string; cls: string }[] = [
  { label: 'Critical', cls: 'border-severity-critical text-severity-critical' },
  { label: 'High', cls: 'border-severity-high text-severity-high' },
  { label: 'Medium', cls: 'border-severity-medium text-severity-medium' },
  { label: 'Low', cls: 'border-severity-low text-severity-low' },
  { label: 'Resolved', cls: 'border-severity-resolved text-severity-resolved' },
];

export default function Overview() {
  const { user, logout, authFetch } = useAuth();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthErr, setHealthErr] = useState(false);
  const [probeResults, setProbeResults] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setHealth)
      .catch(() => setHealthErr(true));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        PROBES.map(async (p) => {
          const res = await authFetch(p.path, { method: p.method ?? 'GET' });
          return [p.path, res.status] as const;
        }),
      );
      if (!cancelled) setProbeResults(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  return (
    <div className="mx-auto max-w-[1440px] p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="severity-rail border-accent-primary pl-3 text-2xl font-semibold">
            Grid Sentry
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Signed in as <span className="font-mono text-text-primary">{user?.email}</span> ·{' '}
            <span className="uppercase tracking-wide text-accent-primary">{user?.role}</span>
          </p>
        </div>
        <button
          onClick={() => logout()}
          className="rounded border border-border-default px-4 py-2 text-sm text-text-primary hover:bg-bg-surface-raised"
        >
          Sign out
        </button>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* System health */}
        <section className="rounded-card border border-border-default bg-bg-surface p-6">
          <h2 className="mb-4 text-lg font-semibold">System health</h2>
          {healthErr ? (
            <p className="text-severity-critical">Backend unreachable.</p>
          ) : !health ? (
            <p className="text-text-secondary">Checking…</p>
          ) : (
            <ul className="space-y-2 font-mono text-sm">
              <li>
                API: <StatusDot ok /> {health.status}
              </li>
              <li>
                Postgres: <StatusDot ok={health.dependencies.postgres} />{' '}
                {health.dependencies.postgres ? 'connected' : 'down'}
              </li>
              <li>
                OpenSearch: <StatusDot ok={health.dependencies.opensearch} />{' '}
                {health.dependencies.opensearch ? 'connected' : 'down'}
              </li>
            </ul>
          )}
        </section>

        {/* RBAC matrix, live for the current role */}
        <section className="rounded-card border border-border-default bg-bg-surface p-6">
          <h2 className="mb-1 text-lg font-semibold">Your access (RBAC)</h2>
          <p className="mb-4 text-xs text-text-secondary">
            Enforced server-side — probed live from your session.
          </p>
          <ul className="space-y-2 text-sm">
            {PROBES.map((p) => {
              const status = probeResults[p.path];
              const allowed = status === 200;
              return (
                <li key={p.path} className="flex items-center justify-between">
                  <span>{p.label}</span>
                  <span
                    className={`rounded border px-2 py-0.5 font-mono text-xs ${
                      status === undefined
                        ? 'border-border-default text-text-disabled'
                        : allowed
                          ? 'border-severity-resolved text-severity-resolved'
                          : 'border-severity-critical text-severity-critical'
                    }`}
                  >
                    {status === undefined ? '…' : allowed ? 'allowed' : `denied (${status})`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Design-system strip: proves the severity palette + fonts are wired. */}
      <section className="mt-6 rounded-card border border-border-default bg-bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold">Severity scale</h2>
        <div className="flex flex-wrap gap-3">
          {severityChips.map((s) => (
            <span
              key={s.label}
              className={`severity-rail ${s.cls} rounded bg-bg-surface-raised px-3 py-1 text-sm`}
            >
              {s.label}
            </span>
          ))}
        </div>
        <p className="mt-4 font-mono text-xs text-text-secondary">
          Foundation ready — TICKET-000 → 002 complete. Ingestion, rules, alerts, and
          dashboard land in TICKET-003+.
        </p>
      </section>
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-severity-resolved' : 'bg-severity-critical'}`}
    />
  );
}
