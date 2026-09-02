import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  fetchUsers,
  fetchInvitations,
  sendInvitation,
  revokeInvitation,
  suspendUser,
  reactivateUser,
  updateUserRole,
  type UserAccount,
  type Invitation,
  type Role,
} from '../api/users.js';

export default function UserManagement() {
  const { authFetch, user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  // Data states
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspendingUser, setSuspendingUser] = useState<UserAccount | null>(null);

  // Invite Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('analyst');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Suspend Form
  const [suspendReason, setSuspendReason] = useState('');
  const [confirmSelf, setConfirmSelf] = useState(false);
  const [suspendError, setSuspendError] = useState<string | null>(null);
  const [suspending, setSuspending] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, invitesData] = await Promise.all([
        fetchUsers(authFetch),
        isAdmin ? fetchInvitations(authFetch).catch(() => []) : Promise.resolve([]),
      ]);
      setUsers(usersData);
      setInvitations(invitesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organization team data');
    } finally {
      setLoading(false);
    }
  }, [authFetch, isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openInviteModal() {
    setInviteEmail('');
    setInviteRole('analyst');
    setInviteError(null);
    setCreatedInviteUrl(null);
    setInviteModalOpen(true);
  }

  function openSuspendModal(user: UserAccount) {
    setSuspendingUser(user);
    setSuspendReason('');
    setConfirmSelf(false);
    setSuspendError(null);
    setSuspendModalOpen(true);
  }

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setCreatedInviteUrl(null);
    setSendingInvite(true);
    try {
      const result = await sendInvitation(authFetch, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      if (result.inviteUrl) {
        setCreatedInviteUrl(result.inviteUrl);
      }
      loadData();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setSendingInvite(false);
    }
  }

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt('Copy invitation link:', text);
    }
  }

  async function handleRevokeInvite(inv: Invitation) {
    if (!window.confirm(`Revoke invitation for ${inv.email}?`)) return;
    try {
      await revokeInvitation(authFetch, inv.id);
      loadData();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to revoke invitation');
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
      loadData();
    } catch (err) {
      setSuspendError(err instanceof Error ? err.message : 'Failed to suspend user');
    } finally {
      setSuspending(false);
    }
  }

  async function handleReactivateUser(user: UserAccount) {
    try {
      await reactivateUser(authFetch, user.id);
      loadData();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to reactivate user');
    }
  }

  async function handleRoleChange(user: UserAccount, role: Role) {
    try {
      await updateUserRole(authFetch, user.id, role);
      loadData();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to update role');
    }
  }

  function formatTimestamp(ts: string): string {
    try {
      return new Date(ts).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      });
    } catch {
      return ts;
    }
  }

  function formatExpiration(ts: string): string {
    try {
      const exp = new Date(ts);
      const diffMs = exp.getTime() - Date.now();
      if (diffMs <= 0) return 'Expired';
      const hours = Math.round(diffMs / (1000 * 60 * 60));
      return `Expires in ${hours}h`;
    } catch {
      return ts;
    }
  }

  const pendingInvites = invitations.filter((i) => i.status === 'pending');

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-text-primary">Team & Organization</h1>
            <span className="rounded bg-accent-primary/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-accent-primary border border-accent-primary/30">
              MULTI-TENANT
            </span>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Manage organization members, role privileges, and pending email invitations.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openInviteModal}
            className="flex items-center gap-2 rounded bg-accent-primary px-4 py-2 text-sm font-semibold text-bg-base transition-opacity hover:opacity-90 shadow-sm"
          >
            <span>✉</span>
            <span>Invite Teammate</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-border-default">
        <button
          onClick={() => setActiveTab('members')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 px-3 ${
            activeTab === 'members'
              ? 'border-accent-primary text-accent-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Active Members ({users.length})
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('invitations')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 px-3 flex items-center gap-2 ${
              activeTab === 'invitations'
                ? 'border-accent-primary text-accent-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <span>Pending Invitations</span>
            {pendingInvites.length > 0 && (
              <span className="rounded-full bg-accent-primary/20 px-2 py-0.5 text-xs font-mono font-bold text-accent-primary">
                {pendingInvites.length}
              </span>
            )}
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
      ) : activeTab === 'members' ? (
        /* ── Active Members Table ── */
        <div className="overflow-x-auto rounded-card border border-border-default">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-default bg-bg-surface text-text-secondary">
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Suspended Reason</th>
                <th className="px-4 py-3 font-medium">Joined Date</th>
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

                  {/* Member Name & Email */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="font-medium text-text-primary flex items-center gap-2">
                      <span>{u.name || 'Unnamed Operator'}</span>
                      {currentUser?.email === u.email && (
                        <span className="rounded bg-accent-primary/15 px-1.5 py-0.2 font-mono text-[10px] font-bold text-accent-primary">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-text-secondary">{u.email}</div>
                  </td>

                  {/* Role */}
                  <td className="whitespace-nowrap px-4 py-3">
                    {isAdmin ? (
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u, e.target.value as Role)}
                        className="rounded border border-border-default bg-bg-base px-2 py-1 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                      >
                        <option value="viewer">viewer (Read-only)</option>
                        <option value="analyst">analyst (Triage & Notes)</option>
                        <option value="admin">admin (Full Control)</option>
                      </select>
                    ) : (
                      <span className="font-mono text-xs uppercase text-accent-primary">{u.role}</span>
                    )}
                  </td>

                  {/* Suspended Reason */}
                  <td className="px-4 py-3 text-text-secondary truncate max-w-xs">
                    {u.suspended_reason ?? '—'}
                  </td>

                  {/* Joined Date */}
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
      ) : (
        /* ── Pending Invitations Table ── */
        <div className="overflow-x-auto rounded-card border border-border-default">
          {invitations.length === 0 ? (
            <div className="p-8 text-center text-text-secondary text-sm">
              No pending invitations. Click <strong>"Invite Teammate"</strong> to generate and send an invitation.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border-default bg-bg-surface text-text-secondary">
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Invitee Email</th>
                  <th className="px-4 py-3 font-medium">Role Preset</th>
                  <th className="px-4 py-3 font-medium">Expiration</th>
                  <th className="px-4 py-3 font-medium">Sent Date</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-border-default bg-bg-surface transition-colors hover:bg-bg-surface-raised"
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`rounded border px-2 py-0.5 font-mono text-[11px] ${
                          inv.status === 'pending'
                            ? 'border-accent-primary text-accent-primary bg-accent-primary/10'
                            : inv.status === 'accepted'
                              ? 'border-severity-resolved text-severity-resolved bg-severity-resolved/10'
                              : 'border-text-disabled text-text-disabled bg-bg-base'
                        }`}
                      >
                        {inv.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono font-medium text-text-primary">
                      {inv.email}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs uppercase text-accent-primary">
                      {inv.role}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary font-mono">
                      {formatExpiration(inv.expiresAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary font-mono">
                      {formatTimestamp(inv.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {inv.status === 'pending' && inv.inviteUrl && (
                          <button
                            onClick={() => copyToClipboard(inv.inviteUrl!, inv.id)}
                            className="rounded border border-border-default bg-bg-surface px-2.5 py-1 text-xs text-text-secondary hover:bg-bg-surface-raised hover:text-accent-primary"
                          >
                            {copiedId === inv.id ? '✓ Copied Link' : '📋 Copy Link'}
                          </button>
                        )}
                        {inv.status === 'pending' && (
                          <button
                            onClick={() => handleRevokeInvite(inv)}
                            className="rounded px-2.5 py-1 text-xs text-severity-critical hover:bg-bg-surface-raised"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Invite Teammate Modal ────────────────────────────────────────── */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 p-4">
          <div className="w-full max-w-lg rounded-modal border border-border-default bg-bg-surface-raised p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-border-default pb-3">
              <div className="flex items-center gap-2">
                <span className="text-accent-primary text-lg">✉</span>
                <h2 className="text-base font-semibold text-text-primary">Invite Teammate</h2>
              </div>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="rounded p-1 text-text-secondary hover:bg-bg-surface hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            {createdInviteUrl ? (
              <div className="space-y-4">
                <div className="rounded border border-severity-resolved/40 bg-severity-resolved/10 p-3.5 text-xs text-severity-resolved">
                  <p className="font-semibold text-severity-resolved flex items-center gap-1.5 mb-1">
                    ✓ Invitation Created Successfully!
                  </p>
                  Invitation for <strong>{inviteEmail}</strong> has been registered. You can copy the link below and send it directly:
                </div>

                <div>
                  <label className="mb-1 block text-text-secondary text-xs font-medium">Direct Invitation Link</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdInviteUrl}
                      className="w-full rounded border border-border-default bg-bg-surface px-3 py-2 font-mono text-xs text-text-primary select-all focus:outline-none"
                    />
                    <button
                      onClick={() => copyToClipboard(createdInviteUrl, 'modal')}
                      className="shrink-0 rounded bg-accent-primary px-3.5 py-2 text-xs font-semibold text-bg-base hover:opacity-90"
                    >
                      {copiedId === 'modal' ? '✓ Copied' : 'Copy Link'}
                    </button>
                  </div>
                </div>

                <div className="border-t border-border-default pt-4 flex justify-end">
                  <button
                    onClick={() => {
                      setInviteModalOpen(false);
                      setCreatedInviteUrl(null);
                    }}
                    className="rounded bg-bg-surface border border-border-default px-4 py-2 text-xs font-semibold text-text-primary hover:bg-bg-surface-raised"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendInvite} className="space-y-4 text-xs">
                {inviteError && (
                  <div className="rounded border border-severity-critical/30 bg-severity-critical/5 px-3 py-2 text-xs text-severity-critical">
                    {inviteError}
                  </div>
                )}

                <p className="text-text-secondary">
                  Invitations generate a secure single-use registration link. The role assigned here is server-enforced and cannot be altered by the invitee.
                </p>

                <div>
                  <label className="mb-1 block text-text-secondary font-medium">Work Email Address *</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="analyst@organization.com"
                    className="w-full rounded border border-border-default bg-bg-surface px-3 py-2 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-text-secondary font-medium">Assigned Organization Role *</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as Role)}
                    className="w-full rounded border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                  >
                    <option value="analyst">Analyst (Triage Alerts, Add Notes, IP Defense)</option>
                    <option value="viewer">Viewer (Read-only Dashboard & Logs)</option>
                    <option value="admin">Admin (Full Control, Rules, Team & Billing)</option>
                  </select>
                </div>

                <div className="rounded border border-border-default bg-bg-base/40 p-2.5 text-[11px] text-text-secondary">
                  <span className="font-semibold text-text-primary">⏳ 72-Hour Validity:</span> You will also be given the direct link to share immediately via Slack, Teams, or direct email.
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-border-default pt-4">
                  <button
                    type="button"
                    onClick={() => setInviteModalOpen(false)}
                    className="rounded border border-border-default px-4 py-2 text-text-secondary hover:bg-bg-surface"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sendingInvite}
                    className="rounded bg-accent-primary px-4 py-2 font-semibold text-bg-base transition-opacity disabled:opacity-50"
                  >
                    {sendingInvite ? 'Generating Invitation…' : 'Generate & Send Invite'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Suspend User Modal ────────────────────────────────────────── */}
      {suspendModalOpen && suspendingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 p-4">
          <div className="w-full max-w-md rounded-modal border border-border-default bg-bg-surface-raised p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-border-default pb-3">
              <h2 className="text-base font-semibold text-severity-critical">
                Suspend Member: {suspendingUser.email}
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
                <label className="mb-1 block text-text-secondary font-medium">Suspension Reason *</label>
                <textarea
                  rows={3}
                  required
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="e.g. Account compromised / Role transitioned"
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
                  {suspending ? 'Suspending…' : 'Suspend Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
