/**
 * Blocklist API Client (TICKET-007).
 * Typed fetch wrappers using authFetch from AuthContext.
 */

export interface BlocklistEntry {
  id: number;
  ip_address: string;
  reason: string | null;
  triggered_by_rule_id: number | null;
  added_by: number | null;
  expires_at: string | null;
  created_at: string;
  rule_name: string | null;
  added_by_email: string | null;
  type: 'manual' | 'rule';
}

export interface AddBlockInput {
  ipAddress: string;
  reason?: string;
  expiresAt?: string | null;
}

export interface AddBlockResponse {
  alreadyBlocked: boolean;
  message: string;
  data: BlocklistEntry;
}

type AuthFetch = (path: string, init?: RequestInit) => Promise<Response>;

export async function fetchBlocklist(authFetch: AuthFetch): Promise<BlocklistEntry[]> {
  const res = await authFetch('/blocklist');
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to fetch blocklist (${res.status})`);
  }
  const data = (await res.json()) as { data: BlocklistEntry[] };
  return data.data;
}

export async function addBlocklistIp(
  authFetch: AuthFetch,
  input: AddBlockInput,
): Promise<AddBlockResponse> {
  const res = await authFetch('/blocklist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to add IP to blocklist (${res.status})`);
  }
  return (await res.json()) as AddBlockResponse;
}

export async function removeBlocklistIp(authFetch: AuthFetch, id: number): Promise<void> {
  const res = await authFetch(`/blocklist/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to remove IP from blocklist (${res.status})`);
  }
}
