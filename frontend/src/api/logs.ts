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

/**
 * Raw log event ingested directly from a connected source website/app.
 * Stored in the user's private BYODB MongoDB instance.
 */
export interface TenantSourceLog {
  _id?: string;
  timestamp: string;
  event_type: string;
  source_ip: string;
  user_identifier?: string | null;
  raw_message: string;
  source_id: number;
  app_name: string;
  org_id?: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface TenantSourceLogsResponse {
  logs: TenantSourceLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  source: 'user_private_database' | 'siem_engine';
  hasTenantDb: boolean;
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

/**
 * Fetch raw logs directly from a connected source's private BYODB.
 * Falls back to OpenSearch search if tenant DB is not configured.
 *
 * @param sourceId - The numeric ID of the connected source (api key ID)
 * @param appName  - The app_name of the connected source (used as fallback)
 * @param page     - 1-based page number
 * @param pageSize - Results per page
 */
export async function fetchSourceRawLogs(
  authFetch: AuthFetch,
  sourceId: number,
  appName: string,
  page: number = 1,
  pageSize: number = 50,
  keyword?: string,
  eventType?: string,
  sourceIp?: string,
): Promise<TenantSourceLogsResponse> {
  // 1. Try tenant BYODB first
  const byodbQuery = new URLSearchParams();
  byodbQuery.set('sourceId', String(sourceId));
  byodbQuery.set('appName', appName);
  byodbQuery.set('limit', String(pageSize));
  byodbQuery.set('skip', String((page - 1) * pageSize));

  const byodbRes = await authFetch(`/logs/tenant-source-logs?${byodbQuery.toString()}`);
  if (byodbRes.ok) {
    const body = (await byodbRes.json()) as { status: string; source: string; data: TenantSourceLog[] };
    const logs = body.data ?? [];

    if (logs.length > 0) {
      // Apply client-side filtering for keyword / eventType / sourceIp
      let filtered = logs;
      if (keyword) {
        const kw = keyword.toLowerCase();
        filtered = filtered.filter(
          (l) =>
            l.raw_message?.toLowerCase().includes(kw) ||
            l.event_type?.toLowerCase().includes(kw) ||
            l.user_identifier?.toLowerCase().includes(kw) ||
            JSON.stringify(l.details).toLowerCase().includes(kw),
        );
      }
      if (eventType) {
        filtered = filtered.filter((l) => l.event_type?.toLowerCase().includes(eventType.toLowerCase()));
      }
      if (sourceIp) {
        filtered = filtered.filter((l) => l.source_ip?.includes(sourceIp));
      }

      return {
        logs: filtered,
        total: filtered.length,
        page,
        pageSize,
        totalPages: Math.ceil(filtered.length / pageSize) || 1,
        source: 'user_private_database',
        hasTenantDb: true,
      };
    }

    // BYODB connected but no logs yet — still show that state
    return {
      logs: [],
      total: 0,
      page,
      pageSize,
      totalPages: 1,
      source: 'user_private_database',
      hasTenantDb: true,
    };
  }

  // 2. Fallback: search OpenSearch filtered by appName as logSource
  const osQuery = new URLSearchParams();
  osQuery.set('logSource', appName);
  osQuery.set('page', String(page));
  osQuery.set('pageSize', String(pageSize));
  if (keyword) osQuery.set('q', keyword);
  if (sourceIp) osQuery.set('sourceIp', sourceIp);

  const osRes = await authFetch(`/logs/search?${osQuery.toString()}`);
  if (!osRes.ok) {
    return { logs: [], total: 0, page, pageSize, totalPages: 1, source: 'siem_engine', hasTenantDb: false };
  }

  const osBody = (await osRes.json()) as { data: LogSearchResponse };
  const hits = osBody.data?.hits ?? [];

  // Normalize OpenSearch hits to TenantSourceLog shape
  const normalized: TenantSourceLog[] = hits.map((h) => ({
    _id: h._id,
    timestamp: (h._source['@timestamp'] ?? h._source.timestamp ?? '') as string,
    event_type: (h._source.event_type ?? 'unknown') as string,
    source_ip: (h._source.source_ip ?? '—') as string,
    user_identifier: (h._source.ssh_user ?? h._source.user_identifier ?? null) as string | null,
    raw_message: (h._source.raw_message ?? '') as string,
    source_id: 0,
    app_name: appName,
    details: h._source as Record<string, unknown>,
    created_at: (h._source['@timestamp'] ?? h._source.timestamp ?? '') as string,
  }));

  return {
    logs: normalized,
    total: osBody.data?.total ?? normalized.length,
    page: osBody.data?.page ?? page,
    pageSize: osBody.data?.pageSize ?? pageSize,
    totalPages: osBody.data?.totalPages ?? 1,
    source: 'siem_engine',
    hasTenantDb: false,
  };
}
