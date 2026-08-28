/**
 * Audit Log API Client (TICKET-009).
 * Typed fetch wrappers using authFetch from AuthContext.
 */

export interface AuditLogRow {
  id: number;
  user_id: number | null;
  user_email: string | null;
  action: string;
  target_type: string;
  target_id: number | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLogsResponse {
  logs: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuditLogQueryParams {
  action?: string;
  targetType?: string;
  userId?: number;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

type AuthFetch = (path: string, init?: RequestInit) => Promise<Response>;

export async function fetchAuditLogs(
  authFetch: AuthFetch,
  params: AuditLogQueryParams = {},
): Promise<AuditLogsResponse> {
  const query = new URLSearchParams();
  if (params.action) query.set('action', params.action);
  if (params.targetType) query.set('targetType', params.targetType);
  if (params.userId) query.set('userId', params.userId.toString());
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.page) query.set('page', params.page.toString());
  if (params.pageSize) query.set('pageSize', params.pageSize.toString());

  const queryString = query.toString();
  const path = `/audit${queryString ? `?${queryString}` : ''}`;

  const res = await authFetch(path);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to fetch audit logs (${res.status})`);
  }
  const data = (await res.json()) as { data: AuditLogsResponse };
  return data.data;
}
