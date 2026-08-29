/**
 * Tenant Database (BYODB) API Client.
 * Typed fetch wrappers using authFetch from AuthContext.
 */

export interface TenantDbStatus {
  connection_status: 'not_configured' | 'pending' | 'verified' | 'failed';
  last_verified_at: string | null;
  created_at: string | null;
}

type AuthFetch = (path: string, init?: RequestInit) => Promise<Response>;

export async function fetchTenantDbStatus(authFetch: AuthFetch): Promise<TenantDbStatus> {
  const res = await authFetch('/tenant-db/status');
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to fetch database status (${res.status})`);
  }
  const data = (await res.json()) as { data: TenantDbStatus };
  return data.data;
}

export async function connectTenantDb(
  authFetch: AuthFetch,
  connectionString: string,
): Promise<TenantDbStatus> {
  const res = await authFetch('/tenant-db/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connection_string: connectionString }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to connect database (${res.status})`);
  }
  const data = (await res.json()) as { data: TenantDbStatus };
  return data.data;
}

export async function disconnectTenantDb(authFetch: AuthFetch): Promise<void> {
  const res = await authFetch('/tenant-db/disconnect', {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to disconnect database (${res.status})`);
  }
}
