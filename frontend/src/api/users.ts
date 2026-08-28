/**
 * Users API Client (TICKET-007).
 * Typed fetch wrappers using authFetch from AuthContext.
 */

export type Role = 'viewer' | 'analyst' | 'admin';

export interface UserAccount {
  id: number;
  email: string;
  role: Role;
  is_active: boolean;
  suspended_reason: string | null;
  suspended_at: string | null;
  created_at: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: Role;
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

export async function createUser(
  authFetch: AuthFetch,
  input: CreateUserInput,
): Promise<UserAccount> {
  const res = await authFetch('/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to create user (${res.status})`);
  }
  const data = (await res.json()) as { data: UserAccount };
  return data.data;
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
