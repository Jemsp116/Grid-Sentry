/**
 * Users & Organization Invitations API Client (TICKET-007).
 * Typed fetch wrappers using authFetch from AuthContext.
 */

export type Role = 'viewer' | 'analyst' | 'admin';

export interface UserAccount {
  id: number;
  name?: string;
  email: string;
  role: Role;
  orgId: string;
  is_active: boolean;
  invitedBy?: number | null;
  suspended_reason: string | null;
  suspended_at: string | null;
  created_at: string;
}

export interface Invitation {
  id: string;
  orgId: string;
  email: string;
  role: Role;
  invitedBy: number;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: string;
  createdAt: string;
  inviteUrl?: string;
}

export interface InviteInfoResponse {
  email: string;
  role: Role;
  orgId: string;
  orgName: string;
  expiresAt: string;
}

export interface SuspendUserInput {
  reason: string;
  confirm_self?: boolean;
}

type AuthFetch = (path: string, init?: RequestInit) => Promise<Response>;

export async function fetchUsers(authFetch: AuthFetch): Promise<UserAccount[]> {
  const res = await authFetch('/users');
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to fetch users (${res.status})`);
  }
  const data = (await res.json()) as { data: UserAccount[] };
  return data.data;
}

export async function fetchInvitations(authFetch: AuthFetch): Promise<Invitation[]> {
  const res = await authFetch('/org/invitations');
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to fetch invitations (${res.status})`);
  }
  const data = (await res.json()) as { data: Invitation[] };
  return data.data;
}

export async function sendInvitation(
  authFetch: AuthFetch,
  input: { email: string; role: Role },
): Promise<Invitation> {
  const res = await authFetch('/org/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to send invitation (${res.status})`);
  }
  const data = (await res.json()) as { data: Invitation };
  return data.data;
}

export async function revokeInvitation(authFetch: AuthFetch, id: string): Promise<void> {
  const res = await authFetch(`/org/invitations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to revoke invitation (${res.status})`);
  }
}

export async function fetchInviteInfo(token: string): Promise<InviteInfoResponse> {
  const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';
  const res = await fetch(`${API_BASE}/auth/invite/${encodeURIComponent(token)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Invalid or expired invitation (${res.status})`);
  }
  return await res.json();
}

export async function suspendUser(
  authFetch: AuthFetch,
  id: number,
  input: SuspendUserInput,
): Promise<UserAccount> {
  const res = await authFetch(`/users/${id}/suspend`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to suspend user (${res.status})`);
  }
  const data = (await res.json()) as { data: UserAccount };
  return data.data;
}

export async function reactivateUser(authFetch: AuthFetch, id: number): Promise<UserAccount> {
  const res = await authFetch(`/users/${id}/reactivate`, {
    method: 'PATCH',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to reactivate user (${res.status})`);
  }
  const data = (await res.json()) as { data: UserAccount };
  return data.data;
}

export async function updateUserRole(
  authFetch: AuthFetch,
  id: number,
  role: Role,
): Promise<UserAccount> {
  const res = await authFetch(`/users/${id}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to update role (${res.status})`);
  }
  const data = (await res.json()) as { data: UserAccount };
  return data.data;
}

