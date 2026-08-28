import { useCallback, useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useAuth, type Role } from '../context/AuthContext.js';
import {
  fetchDashboardSummary,
  fetchGeoMetrics,
  type DashboardSummary,
  type GeoLocationMetric,
} from '../api/dashboard.js';

interface HealthResponse {
  status: string;
  dependencies: { postgres: boolean; opensearch: boolean };
  ingestion?: { docCount: number };
  time: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

const PROBES: { label: string; path: string; method?: string; minRole: Role }[] = [
  { label: 'View alerts', path: '/alerts', minRole: 'viewer' },
  { label: 'Change alert status', path: '/alerts/1/status', method: 'PATCH', minRole: 'analyst' },
  { label: 'Manage rules', path: '/rules', minRole: 'admin' },
  { label: 'Manage users', path: '/users', minRole: 'admin' },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#E53E3E',
  high: '#DD6B20',
  medium: '#D69E2E',
  low: '#3182CE',
};

export default function Overview() {
  const { authFetch } = useAuth();

  const [lookbackHours, setLookbackHours] = useState(24);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [geoData, setGeoData] = useState<GeoLocationMetric[]>([]);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthErr, setHealthErr] = useState(false);
  const [probeResults, setProbeResults] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumData, geoRes] = await Promise.all([
        fetchDashboardSummary(authFetch, lookbackHours),
        fetchGeoMetrics(authFetch, lookbackHours),
      ]);
      setSummary(sumData);
      setGeoData(geoRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  }, [authFetch, lookbackHours]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

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

  // Bar chart dataset for Severity
  const severityChartData = summary
    ? [
        { name: 'Critical', value: summary.severityBreakdown.critical || 0, severity: 'critical' },
        { name: 'High', value: summary.severityBreakdown.high || 0, severity: 'high' },
        { name: 'Medium', value: summary.severityBreakdown.medium || 0, severity: 'medium' },
        { name: 'Low', value: summary.severityBreakdown.low || 0, severity: 'low' },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header & Lookback Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">SOC Overview Dashboard</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Real-time security posture, threat intelligence, and log ingestion metrics.
          </p>
        </div>

        {/* Time Range Preset Pills */}
        <div className="flex rounded border border-border-default bg-bg-surface p-1">
          {[
            { label: 'Last 24h', hours: 24 },
            { label: 'Last 7d', hours: 168 },
            { label: 'Last 30d', hours: 720 },
          ].map((preset) => (
            <button
              key={preset.hours}
              onClick={() => setLookbackHours(preset.hours)}
              className={`rounded px-3 py-1 text-xs transition-colors ${
                lookbackHours === preset.hours
                  ? 'bg-accent-primary text-bg-base font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded border border-severity-critical/30 bg-severity-critical/5 px-4 py-3 text-sm text-severity-critical">
          {error}
        </div>
      )}

      {/* 4 Metric Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Logs Ingested */}
        <div className="rounded-card border border-border-default bg-bg-surface p-5">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>Logs Ingested</span>
            <span className="font-mono opacity-60">OpenSearch</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold text-text-primary">
              {summary ? summary.totalLogsProcessed.toLocaleString() : '—'}
            </span>
            <span className="text-[10px] font-mono text-severity-resolved">● Live stream</span>
          </div>
        </div>

        {/* Total Security Alerts */}
        <div className="rounded-card border border-border-default bg-bg-surface p-5">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>Security Alerts</span>
            <span className="font-mono opacity-60">{lookbackHours}h Window</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold text-severity-high">
              {summary ? summary.totalAlertsCount.toLocaleString() : '—'}
            </span>
            <span className="text-[10px] font-mono text-text-secondary">
              {summary ? `${summary.statusBreakdown.new || 0} New` : ''}
            </span>
          </div>
        </div>

        {/* Active Blocked IPs */}
        <div className="rounded-card border border-border-default bg-bg-surface p-5">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>Active Blocked IPs</span>
            <span className="font-mono opacity-60">Blocklist</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold text-severity-critical">
              {summary ? summary.activeBlockedIpsCount.toLocaleString() : '—'}
            </span>
            <span className="text-[10px] font-mono text-severity-critical font-semibold">
              Auto-shield active
            </span>
          </div>
        </div>

        {/* System Health */}
        <div className="rounded-card border border-border-default bg-bg-surface p-5">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>Cluster Health</span>
            <span className="font-mono opacity-60">Postgres + OS</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-lg font-bold text-severity-resolved flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${healthErr ? 'bg-severity-critical' : 'bg-severity-resolved'} animate-pulse`} />
              {health ? health.status.toUpperCase() : healthErr ? 'DOWN' : 'ONLINE'}
            </span>
            <span className="text-[10px] font-mono text-text-secondary">
              {health?.dependencies.opensearch ? 'All Online' : 'Connecting'}
            </span>
          </div>
        </div>
      </div>

      {/* Charts Row: Alert Volume Timeline + Severity Distribution */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Alert Volume Timeline (2 Cols) */}
        <div className="rounded-card border border-border-default bg-bg-surface p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-text-primary">Alert Volume Timeline</h2>
              <p className="text-xs text-text-secondary">
                Alert triggers bucketed over the selected lookback window.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex h-56 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
            </div>
          ) : summary && summary.timeSeries.length > 0 ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={summary.timeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="alertGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#DD6B20" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#DD6B20" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232E3B" />
                  <XAxis dataKey="timestamp" stroke="#718096" fontSize={10} tickLine={false} />
                  <YAxis stroke="#718096" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1A202C', borderColor: '#2D3748', fontSize: '11px' }}
                    labelStyle={{ color: '#E2E8F0', fontFamily: 'monospace' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total_count"
                    name="Alerts"
                    stroke="#DD6B20"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#alertGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-56 flex-col items-center justify-center text-xs text-text-secondary">
              No alert activity recorded in this time window.
            </div>
          )}
        </div>

        {/* Severity Distribution (1 Col) */}
        <div className="rounded-card border border-border-default bg-bg-surface p-6">
          <h2 className="text-base font-semibold text-text-primary">Severity Breakdown</h2>
          <p className="mb-4 text-xs text-text-secondary">
            Alert counts by assigned severity level.
          </p>

          {loading ? (
            <div className="flex h-56 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232E3B" />
                  <XAxis dataKey="name" stroke="#718096" fontSize={10} tickLine={false} />
                  <YAxis stroke="#718096" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1A202C', borderColor: '#2D3748', fontSize: '11px' }}
                  />
                  <Bar dataKey="value" name="Count" radius={[4, 4, 0, 0]}>
                    {severityChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={SEVERITY_COLORS[entry.severity] || '#3182CE'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Top 10 Attacker IPs Leaderboard + Geo-IP Threat Locations */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top 10 Attacker IPs Leaderboard */}
        <div className="rounded-card border border-border-default bg-bg-surface p-6">
          <h2 className="mb-1 text-base font-semibold text-text-primary">Top Attacker IPs</h2>
          <p className="mb-4 text-xs text-text-secondary">
            Most frequent alert source IPs resolved via Geo-IP lookup.
          </p>

          {!summary || summary.topAttackerIps.length === 0 ? (
            <p className="text-xs text-text-secondary py-8 text-center">No attacker IP data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border-default text-text-secondary">
                    <th className="py-2 font-medium">Rank</th>
                    <th className="py-2 font-medium">IP Address</th>
                    <th className="py-2 font-medium">Country / Origin</th>
                    <th className="py-2 font-medium text-right">Alerts</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topAttackerIps.map((attacker, idx) => (
                    <tr key={attacker.source_ip} className="border-b border-border-default/50 font-mono">
                      <td className="py-2.5 text-text-secondary">#{idx + 1}</td>
                      <td className="py-2.5 font-bold text-text-primary">
                        {attacker.source_ip}
                      </td>
                      <td className="py-2.5 text-text-secondary">
                        <span className="inline-flex items-center gap-1.5">
                          {attacker.geo.countryCode} · {attacker.geo.countryName}
                          {attacker.geo.isHighRisk && (
                            <span className="rounded bg-severity-critical/20 border border-severity-critical text-severity-critical px-1 text-[9px] font-sans font-semibold">
                              HIGH RISK
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-bold text-severity-high">
                        {attacker.alert_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Geo-IP Threat Origin Distribution */}
        <div className="rounded-card border border-border-default bg-bg-surface p-6">
          <h2 className="mb-1 text-base font-semibold text-text-primary">Geo-IP Threat Locations</h2>
          <p className="mb-4 text-xs text-text-secondary">
            Geographic distribution of alert origins resolved via GeoLite2.
          </p>

          {geoData.length === 0 ? (
            <p className="text-xs text-text-secondary py-8 text-center">No geographic metrics available.</p>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {geoData.map((location) => (
                <div key={location.countryCode} className="rounded border border-border-default bg-bg-base p-3 text-xs">
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-semibold text-text-primary flex items-center gap-2">
                      [{location.countryCode}] {location.countryName}
                      {location.isHighRisk && (
                        <span className="rounded bg-severity-critical/20 border border-severity-critical text-severity-critical px-1.5 py-0.5 text-[9px] font-sans font-bold">
                          DANGER REGION
                        </span>
                      )}
                    </span>
                    <span className="font-bold text-accent-primary">{location.alertCount} alerts</span>
                  </div>
                  {location.sampleIps.length > 0 && (
                    <p className="mt-1 font-mono text-[11px] text-text-secondary">
                      Sample IPs: {location.sampleIps.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* System Probes Strip */}
      <div className="rounded-card border border-border-default bg-bg-surface p-6">
        <h2 className="mb-3 text-base font-semibold text-text-primary">RBAC & Subsystem Probes</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs font-mono">
          {PROBES.map((p) => {
            const status = probeResults[p.path];
            const allowed = status === 200;
            return (
              <div key={p.path} className="flex items-center justify-between rounded border border-border-default bg-bg-base p-2.5">
                <span>{p.label}</span>
                <span
                  className={`rounded border px-2 py-0.5 text-[10px] ${
                    status === undefined
                      ? 'border-border-default text-text-disabled'
                      : allowed
                        ? 'border-severity-resolved text-severity-resolved'
                        : 'border-severity-critical text-severity-critical'
                  }`}
                >
                  {status === undefined ? '…' : allowed ? 'ALLOWED (200)' : `DENIED (${status})`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
