/**
 * API Keys Client.
 * Typed fetch wrappers using authFetch from AuthContext.
 */

export interface ApiKeyItem {
  id: number;
  app_name: string;
  is_active: boolean;
  created_by: number;
  last_used_at: string | null;
  created_at: string;
}

export interface CreatedApiKeyResponse extends ApiKeyItem {
  raw_key: string;
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
): Promise<CreatedApiKeyResponse> {
  const res = await authFetch('/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_name: appName }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to generate API key (${res.status})`);
  }
  const data = (await res.json()) as { data: CreatedApiKeyResponse };
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
