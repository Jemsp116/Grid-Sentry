/**
 * Alerts API Client (TICKET-006).
 * Typed fetch wrappers using authFetch from AuthContext.
 */

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'new' | 'investigating' | 'resolved' | 'false_positive';

export interface Alert {
  id: number;
  rule_id: number;
  source_ip: string;
  target_host: string | null;
  severity: SeverityLevel;
  status: AlertStatus;
  opensearch_log_ids: string[];
  assigned_to: number | null;
  created_at: string;
  rule_name: string;
  rule_description: string | null;
  log_source: string;
  match_conditions: unknown;
  threshold: number;
  time_window_seconds: number;
  action_on_trigger: string;
  mitre_technique_id: string | null;
  assigned_to_email: string | null;
}

export interface AlertNote {
  id: number;
  alert_id: number;
  user_id: number;
  user_email: string;
  note: string;
  created_at: string;
}

export interface ThreatIntelData {
  ip: string;
  abuseConfidenceScore: number;
  totalReports: number;
  isp: string;
  usageType: string;
  domain: string;
  countryCode: string;
  countryName: string;
  isWhitelisted: boolean;
  lastReportedAt: string | null;
  cachedAt: string;
  source: 'abuseipdb' | 'otx' | 'heuristic_demo';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface RawEvidenceLog {
  _id: string;
  _index: string;
  _source: {
    '@timestamp'?: string;
    timestamp?: string;
    source_ip?: string;
    ssh_user?: string;
    log_source?: string;
    event_type?: string;
    outcome?: string;
    raw_message?: string;
    host?: string;
    [key: string]: unknown;
  };
}

export interface AlertFilterParams {
  severity?: SeverityLevel;
  status?: AlertStatus;
  sourceIp?: string;
  mitreId?: string;
  page?: number;
  pageSize?: number;
}

export interface AlertsResponse {
  alerts: Alert[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type AuthFetch = (path: string, init?: RequestInit) => Promise<Response>;

export async function fetchAlerts(
  authFetch: AuthFetch,
  params: AlertFilterParams = {},
): Promise<AlertsResponse> {
  const query = new URLSearchParams();
  if (params.severity) query.set('severity', params.severity);
  if (params.status) query.set('status', params.status);
  if (params.sourceIp) query.set('sourceIp', params.sourceIp);
  if (params.mitreId) query.set('mitreId', params.mitreId);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));

  const qs = query.toString();
  const res = await authFetch(`/alerts${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to fetch alerts (${res.status})`);
  }
  const data = (await res.json()) as { data: AlertsResponse };
  return data.data;
}

export async function fetchAlertById(authFetch: AuthFetch, id: number): Promise<Alert> {
  const res = await authFetch(`/alerts/${id}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to fetch alert (${res.status})`);
  }
  const data = (await res.json()) as { data: Alert };
  return data.data;
}

export async function updateAlertStatus(
  authFetch: AuthFetch,
  id: number,
  status: AlertStatus,
  assignedTo?: number | null,
): Promise<Alert> {
  const res = await authFetch(`/alerts/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, assigned_to: assignedTo }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to update status (${res.status})`);
  }
  const data = (await res.json()) as { data: Alert };
  return data.data;
}

export async function fetchAlertNotes(authFetch: AuthFetch, id: number): Promise<AlertNote[]> {
  const res = await authFetch(`/alerts/${id}/notes`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to fetch alert notes (${res.status})`);
  }
  const data = (await res.json()) as { data: AlertNote[] };
  return data.data;
}

export async function addAlertNote(
  authFetch: AuthFetch,
  id: number,
  note: string,
): Promise<AlertNote> {
  const res = await authFetch(`/alerts/${id}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to add note (${res.status})`);
  }
  const data = (await res.json()) as { data: AlertNote };
  return data.data;
}

export async function fetchAlertRawLogs(
  authFetch: AuthFetch,
  id: number,
): Promise<RawEvidenceLog[]> {
  const res = await authFetch(`/alerts/${id}/raw-logs`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to fetch raw evidence logs (${res.status})`);
  }
  const data = (await res.json()) as { data: RawEvidenceLog[] };
  return data.data;
}

export async function fetchIpThreatIntel(
  authFetch: AuthFetch,
  ipAddress: string,
): Promise<ThreatIntelData> {
  const res = await authFetch(`/alerts/ip-intel/${encodeURIComponent(ipAddress)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to fetch threat intel (${res.status})`);
  }
  const data = (await res.json()) as { data: ThreatIntelData };
  return data.data;
}

export async function exportAlertsReport(
  authFetch: AuthFetch,
  params: AlertFilterParams = {},
  format: 'csv' | 'json' = 'csv',
): Promise<void> {
  const query = new URLSearchParams();
  if (params.severity) query.set('severity', params.severity);
  if (params.status) query.set('status', params.status);
  if (params.sourceIp) query.set('sourceIp', params.sourceIp);
  if (params.mitreId) query.set('mitreId', params.mitreId);
  query.set('format', format);

  const res = await authFetch(`/alerts/export?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to export report (${res.status})`);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `grid-sentry-alerts-export.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
