/**
 * API Keys & Connected Sources Client.
 * Typed fetch wrappers using authFetch from AuthContext.
 */

export interface ApiKeyItem {
  id: number;
  orgId: string;
  app_name: string;
  is_active: boolean;
  connection_method?: 'code' | 'agent';
  created_by: number;
  first_event_at?: string | null;
  last_used_at: string | null;
  event_count?: number;
  created_at: string;
}

export interface CreatedApiKeyResponse extends ApiKeyItem {
  raw_key: string;
}

export interface ApiKeyStatusResponse {
  id: number;
  app_name: string;
  is_active: boolean;
  connection_method: 'code' | 'agent';
  is_connected: boolean;
  first_event_at: string | null;
  last_used_at: string | null;
  event_count: number;
}

type AuthFetch = (path: string, init?: RequestInit) => Promise<Response>;

export async function fetchApiKeys(authFetch: AuthFetch): Promise<ApiKeyItem[]> {
  const res = await authFetch('/api-keys');
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to fetch API keys (${res.status})`);
  }
  const data = (await res.json()) as { data: ApiKeyItem[] };
  return data.data;
}

export async function createApiKey(
  authFetch: AuthFetch,
  appName: string,
  connectionMethod: 'code' | 'agent' = 'code',
): Promise<CreatedApiKeyResponse> {
  const res = await authFetch('/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_name: appName, connection_method: connectionMethod }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to generate API key (${res.status})`);
  }
  const data = (await res.json()) as { data: CreatedApiKeyResponse };
  return data.data;
}

export async function fetchApiKeyStatus(
  authFetch: AuthFetch,
  id: number,
): Promise<ApiKeyStatusResponse> {
  const res = await authFetch(`/api-keys/${id}/status`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to fetch API key status (${res.status})`);
  }
  const data = (await res.json()) as { data: ApiKeyStatusResponse };
  return data.data;
}

export async function revokeApiKey(authFetch: AuthFetch, id: number): Promise<ApiKeyItem> {
  const res = await authFetch(`/api-keys/${id}/revoke`, {
    method: 'PATCH',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to revoke API key (${res.status})`);
  }
  const data = (await res.json()) as { data: ApiKeyItem };
  return data.data;
}

export async function sendSampleLogEvent(rawKey: string, appName: string): Promise<boolean> {
  const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';
  const url = `${API_BASE}/logs/ingest`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': rawKey,
    },
    body: JSON.stringify([
      {
        timestamp: new Date().toISOString(),
        event_type: 'source_verification_ping',
        source_ip: '127.0.0.1',
        user_identifier: 'system_probe@gridsentry.local',
        raw_message: `Initial telemetry handshake verified from ${appName}`,
        details: { probe_id: 'gs_probe_init', status: 'verified', source: appName },
      },
    ]),
  });
  return res.ok;
}
