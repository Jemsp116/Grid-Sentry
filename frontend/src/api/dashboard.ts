/**
 * Dashboard API Client (TICKET-008).
 * Typed fetch wrappers using authFetch from AuthContext.
 */

export interface GeoIpResult {
  ip: string;
  countryCode: string;
  countryName: string;
  city: string;
  ll: [number, number];
  isHighRisk: boolean;
  isPrivate: boolean;
}

export interface TopAttackerIp {
  source_ip: string;
  alert_count: number;
  max_severity: string;
  geo: GeoIpResult;
}

export interface TimeSeriesBucket {
  timestamp: string;
  new_count: number;
  investigating_count: number;
  resolved_count: number;
  critical_count: number;
  total_count: number;
}

export interface DashboardSummary {
  lookbackHours: number;
  totalLogsProcessed: number;
  totalAlertsCount: number;
  activeBlockedIpsCount: number;
  severityBreakdown: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  statusBreakdown: {
    new: number;
    investigating: number;
    resolved: number;
    false_positive: number;
  };
  topAttackerIps: TopAttackerIp[];
  timeSeries: TimeSeriesBucket[];
}

export interface GeoLocationMetric {
  countryCode: string;
  countryName: string;
  alertCount: number;
  isHighRisk: boolean;
  isPrivate: boolean;
  sampleIps: string[];
  coordinates: [number, number];
}

type AuthFetch = (path: string, init?: RequestInit) => Promise<Response>;

export async function fetchDashboardSummary(
  authFetch: AuthFetch,
  lookbackHours = 24,
): Promise<DashboardSummary> {
  const res = await authFetch(`/dashboard/summary?lookbackHours=${lookbackHours}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to fetch dashboard summary (${res.status})`);
  }
  const data = (await res.json()) as { data: DashboardSummary };
  return data.data;
}

export async function fetchGeoMetrics(
  authFetch: AuthFetch,
  lookbackHours = 24,
): Promise<GeoLocationMetric[]> {
  const res = await authFetch(`/dashboard/geo?lookbackHours=${lookbackHours}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to fetch geo metrics (${res.status})`);
  }
  const data = (await res.json()) as { data: GeoLocationMetric[] };
  return data.data;
}
