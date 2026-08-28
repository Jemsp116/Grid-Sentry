/**
 * Log search API client (TICKET-004).
 * Typed fetch wrappers that use authFetch from AuthContext.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LogEntry {
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

export interface LogSearchParams {
  q?: string;
  from?: string;
  to?: string;
  logSource?: string;
  sourceIp?: string;
  outcome?: string;
  page?: number;
  pageSize?: number;
}

export interface LogSearchResponse {
  hits: LogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── API functions ──────────────────────────────────────────────────────────

type AuthFetch = (path: string, init?: RequestInit) => Promise<Response>;

/**
 * Search logs with optional filters. Returns paginated results.
 */
export async function searchLogs(
  authFetch: AuthFetch,
  params: LogSearchParams = {},
): Promise<LogSearchResponse> {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.logSource) query.set('logSource', params.logSource);
  if (params.sourceIp) query.set('sourceIp', params.sourceIp);
  if (params.outcome) query.set('outcome', params.outcome);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));

  const qs = query.toString();
  const res = await authFetch(`/logs/search${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Search failed (${res.status})`);
  }
  const data = (await res.json()) as { data: LogSearchResponse };
  return data.data;
}

/**
 * Fetch a single log document by OpenSearch _id.
 */
export async function getLogById(
  authFetch: AuthFetch,
  id: string,
): Promise<LogEntry> {
  const res = await authFetch(`/logs/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to fetch log (${res.status})`);
  }
  const data = (await res.json()) as { data: LogEntry };
  return data.data;
}
