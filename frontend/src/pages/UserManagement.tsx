import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  fetchUsers,
  createUser,
  suspendUser,
  reactivateUser,
  updateUserRole,
  type UserAccount,
  type Role,
} from '../api/users.js';

export default function UserManagement() {
  const { authFetch, user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspendingUser, setSuspendingUser] = useState<UserAccount | null>(null);

  // Create Form
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<Role>('viewer');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Suspend Form
  const [suspendReason, setSuspendReason] = useState('');
  const [confirmSelf, setConfirmSelf] = useState(false);
  const [suspendError, setSuspendError] = useState<string | null>(null);
  const [suspending, setSuspending] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUsers(authFetch);
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function openCreateModal() {
    setNewEmail('');
    setNewPassword('');
    setNewRole('viewer');
    setCreateError(null);
    setCreateModalOpen(true);
  }

  function openSuspendModal(user: UserAccount) {
    setSuspendingUser(user);
    setSuspendReason('');
    setConfirmSelf(false);
    setSuspendError(null);
    setSuspendModalOpen(true);
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await createUser(authFetch, {
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
      });
      setCreateModalOpen(false);
      loadUsers();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setCreating(false);
    }
  }

  async function handleSuspendUser(e: React.FormEvent) {
    e.preventDefault();
    if (!suspendingUser) return;
    setSuspendError(null);
    setSuspending(true);

    try {
      await suspendUser(authFetch, suspendingUser.id, {
        reason: suspendReason.trim(),
        confirm_self: confirmSelf,
      });
      setSuspendModalOpen(false);
      loadUsers();
    } catch (err) {
      setSuspendError(err instanceof Error ? err.message : 'Failed to suspend user');
    } finally {
      setSuspending(false);
    }
  }

  async function handleReactivateUser(user: UserAccount) {
    try {
      await reactivateUser(authFetch, user.id);
      loadUsers();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to reactivate user');
    }
  }

  async function handleRoleChange(user: UserAccount, role: Role) {
    try {
      await updateUserRole(authFetch, user.id, role);
      loadUsers();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to update role');
    }
  }

  function formatTimestamp(ts: string): string {
    try {
      return new Date(ts).toLocaleDateString('en-GB', {
        year: 'numeric', month: '2-digit', day: '2-digit',
      });
    } catch {
      return ts;
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">User Management</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage user accounts, roles, and session suspensions.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="rounded bg-accent-primary px-4 py-2 text-sm font-semibold text-bg-base transition-opacity hover:opacity-90"
          >
            + Create User
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded border border-severity-critical/30 bg-severity-critical/5 px-4 py-3 text-sm text-severity-critical">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border-default">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-default bg-bg-surface text-text-secondary">
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Suspended Reason</th>
                <th className="px-4 py-3 font-medium">Created Date</th>
                {isAdmin && <th className="px-4 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-border-default bg-bg-surface transition-colors hover:bg-bg-surface-raised"
                  style={{ minHeight: '44px' }}
                >
                  {/* Status */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`rounded border px-2 py-0.5 font-mono text-[11px] ${
                        u.is_active
                          ? 'border-severity-resolved text-severity-resolved bg-severity-resolved/10'
                          : 'border-severity-critical text-severity-critical bg-severity-critical/10'
                      }`}
                    >
                      {u.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </td>

                  {/* Email */}
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-text-primary">
                    {u.email}
                    {currentUser?.email === u.email && (
                      <span className="ml-2 text-[10px] text-accent-primary">(You)</span>
                    )}
                  </td>

                  {/* Role */}
                  <td className="whitespace-nowrap px-4 py-3">
                    {isAdmin ? (
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u, e.target.value as Role)}
                        className="rounded border border-border-default bg-bg-base px-2 py-1 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                      >
                        <option value="viewer">viewer</option>
                        <option value="analyst">analyst</option>
                        <option value="admin">admin</option>
                      </select>
                    ) : (
                      <span className="font-mono text-xs uppercase text-accent-primary">{u.role}</span>
                    )}
                  </td>

                  {/* Suspended Reason */}
                  <td className="px-4 py-3 text-text-secondary truncate max-w-xs">
                    {u.suspended_reason ?? '—'}
                  </td>

                  {/* Created Date */}
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-text-secondary">
                    {formatTimestamp(u.created_at)}
                  </td>

                  {/* Actions */}
                  {isAdmin && (
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {u.is_active ? (
                        <button
                          onClick={() => openSuspendModal(u)}
                          className="rounded px-2.5 py-1 text-xs text-severity-critical hover:bg-bg-surface-raised"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivateUser(u)}
                          className="rounded px-2.5 py-1 text-xs text-severity-resolved hover:bg-bg-surface-raised"
                        >
                          Reactivate
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create User Modal ────────────────────────────────────────── */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 p-4">
          <div className="w-full max-w-md rounded-modal border border-border-default bg-bg-surface-raised p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-border-default pb-3">
              <h2 className="text-base font-semibold text-text-primary">Create User Account</h2>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="rounded p-1 text-text-secondary hover:bg-bg-surface hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="mb-4 rounded border border-severity-critical/30 bg-severity-critical/5 px-3 py-2 text-xs text-severity-critical">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="mb-1 block text-text-secondary">Email Address *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="analyst@gridsentry.local"
                  className="w-full rounded border border-border-default bg-bg-surface px-3 py-2 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-text-secondary">Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded border border-border-default bg-bg-surface px-3 py-2 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-text-secondary">Role *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  className="w-full rounded border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                >
                  <option value="viewer">Viewer (Read-only)</option>
                  <option value="analyst">Analyst (Triage & Notes)</option>
                  <option value="admin">Admin (Full Access & Rules)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border-default pt-4">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded border border-border-default px-4 py-2 text-text-secondary hover:bg-bg-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded bg-accent-primary px-4 py-2 font-semibold text-bg-base transition-opacity disabled:opacity-50"
                >
                  {creating ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Suspend User Modal ────────────────────────────────────────── */}
      {suspendModalOpen && suspendingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 p-4">
          <div className="w-full max-w-md rounded-modal border border-border-default bg-bg-surface-raised p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-border-default pb-3">
              <h2 className="text-base font-semibold text-severity-critical">
                Suspend User: {suspendingUser.email}
              </h2>
              <button
                onClick={() => setSuspendModalOpen(false)}
                className="rounded p-1 text-text-secondary hover:bg-bg-surface hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            {suspendError && (
              <div className="mb-4 rounded border border-severity-critical/30 bg-severity-critical/5 px-3 py-2 text-xs text-severity-critical">
                {suspendError}
              </div>
            )}

            <form onSubmit={handleSuspendUser} className="space-y-4 text-xs">
              <p className="text-text-secondary">
                Suspending this user will immediately revoke all active refresh tokens and block further login attempts.
              </p>

              <div>
                <label className="mb-1 block text-text-secondary">Suspension Reason *</label>
                <textarea
                  rows={3}
                  required
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="e.g. Account compromised / Policy violation"
                  className="w-full rounded border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                />
              </div>

              {currentUser?.email === suspendingUser.email && (
                <div className="rounded border border-severity-critical/40 bg-severity-critical/10 p-3">
                  <label className="flex items-center gap-2 cursor-pointer text-severity-critical font-semibold">
                    <input
                      type="checkbox"
                      checked={confirmSelf}
                      onChange={(e) => setConfirmSelf(e.target.checked)}
                      className="rounded"
                    />
                    I confirm I want to suspend my OWN Admin account.
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-border-default pt-4">
                <button
                  type="button"
                  onClick={() => setSuspendModalOpen(false)}
                  className="rounded border border-border-default px-4 py-2 text-text-secondary hover:bg-bg-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={suspending || (currentUser?.email === suspendingUser.email && !confirmSelf)}
                  className="rounded bg-severity-critical px-4 py-2 font-semibold text-white transition-opacity disabled:opacity-50"
                >
                  {suspending ? 'Suspending…' : 'Suspend User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
