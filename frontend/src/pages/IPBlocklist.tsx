import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  fetchBlocklist,
  addBlocklistIp,
  removeBlocklistIp,
  type BlocklistEntry,
} from '../api/blocklist.js';

export default function IPBlocklist() {
  const { authFetch, user } = useAuth();
  const canWrite = user?.role === 'analyst' || user?.role === 'admin';

  const [blocklist, setBlocklist] = useState<BlocklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [ipAddress, setIpAddress] = useState('');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [alreadyBlockedNotice, setAlreadyBlockedNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const loadBlocklist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBlocklist(authFetch);
      setBlocklist(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load IP blocklist');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadBlocklist();
  }, [loadBlocklist]);

  async function handleAddIp(e: React.FormEvent) {
    e.preventDefault();
    if (!ipAddress.trim() || !canWrite) return;

    setSubmitting(true);
    setAlreadyBlockedNotice(null);
    setFormError(null);

    try {
      const res = await addBlocklistIp(authFetch, {
        ipAddress: ipAddress.trim(),
        reason: reason.trim() || undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });

      if (res.alreadyBlocked) {
        setAlreadyBlockedNotice(`IP ${res.data.ip_address} is ALREADY on the blocklist (${res.data.reason ?? 'No reason provided'})`);
      } else {
        setIpAddress('');
        setReason('');
        setExpiresAt('');
      }

      loadBlocklist();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to block IP');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnblock(entry: BlocklistEntry) {
    if (!confirm(`Are you sure you want to unblock IP ${entry.ip_address}?`)) return;
    try {
      await removeBlocklistIp(authFetch, entry.id);
      setBlocklist((prev) => prev.filter((b) => b.id !== entry.id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to unblock IP');
    }
  }

  function formatTimestamp(ts?: string | null): string {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString('en-GB', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
        hour12: false,
      });
    } catch {
      return ts;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">IP Blocklist</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage blocked attacker IP addresses and view automated rule block triggers.
        </p>
      </div>

      {/* Add IP Form (Analysts & Admins) */}
      {canWrite && (
        <form
          onSubmit={handleAddIp}
          className="rounded-card border border-border-default bg-bg-surface p-4 text-xs space-y-3"
        >
          <h2 className="text-sm font-semibold text-text-primary">Add IP to Blocklist</h2>

          {alreadyBlockedNotice && (
            <div className="rounded border border-severity-medium/40 bg-severity-medium/10 px-3 py-2 text-severity-medium">
              ℹ {alreadyBlockedNotice}
            </div>
          )}

          {formError && (
            <div className="rounded border border-severity-critical/30 bg-severity-critical/5 px-3 py-2 text-severity-critical">
              {formError}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-text-secondary">IP Address *</label>
              <input
                type="text"
                required
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="e.g. 198.51.100.44"
                className="w-full rounded border border-border-default bg-bg-base px-3 py-2 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-text-secondary">Reason</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Manual block / Threat intel match"
                className="w-full rounded border border-border-default bg-bg-base px-3 py-2 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-text-secondary">Expiration (Optional)</label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded border border-border-default bg-bg-base px-3 py-2 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !ipAddress.trim()}
              className="rounded bg-severity-critical px-4 py-2 font-semibold text-white transition-opacity disabled:opacity-50"
            >
              {submitting ? 'Blocking…' : 'Block IP'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="rounded border border-severity-critical/30 bg-severity-critical/5 px-4 py-3 text-sm text-severity-critical">
          {error}
        </div>
      )}

      {/* Blocklist Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
        </div>
      ) : blocklist.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-card border border-border-default bg-bg-surface py-20">
          <div className="mb-4 text-4xl opacity-30">⊘</div>
          <h3 className="text-sm font-semibold text-text-primary">IP blocklist is empty</h3>
          <p className="mt-1 text-xs text-text-secondary">
            No IP addresses are currently blocked.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border-default">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-default bg-bg-surface text-text-secondary">
                <th className="px-4 py-3 font-medium">IP Address</th>
                <th className="px-4 py-3 font-medium">Source Type</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Blocked Date</th>
                <th className="px-4 py-3 font-medium">Expires At</th>
                {canWrite && <th className="px-4 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {blocklist.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-border-default bg-bg-surface transition-colors hover:bg-bg-surface-raised"
                  style={{ minHeight: '44px' }}
                >
                  {/* IP Address */}
                  <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold text-severity-critical">
                    {entry.ip_address}
                  </td>

                  {/* Source Indicator */}
                  <td className="whitespace-nowrap px-4 py-3">
                    {entry.type === 'rule' ? (
                      <span className="rounded border border-severity-high text-severity-high bg-severity-high/10 px-2 py-0.5 font-mono text-[11px]">
                        ⚡ Rule: {entry.rule_name ?? `ID ${entry.triggered_by_rule_id}`}
                      </span>
                    ) : (
                      <span className="rounded border border-accent-primary text-accent-primary bg-accent-primary/10 px-2 py-0.5 font-mono text-[11px]">
                        👤 Manual: {entry.added_by_email ?? 'System'}
                      </span>
                    )}
                  </td>

                  {/* Reason */}
                  <td className="px-4 py-3 text-text-primary truncate max-w-xs">
                    {entry.reason ?? '—'}
                  </td>

                  {/* Blocked Date */}
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-text-secondary">
                    {formatTimestamp(entry.created_at)}
                  </td>

                  {/* Expires At */}
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-text-secondary">
                    {formatTimestamp(entry.expires_at)}
                  </td>

                  {/* Actions */}
                  {canWrite && (
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        onClick={() => handleUnblock(entry)}
                        className="rounded px-2.5 py-1 text-xs text-severity-resolved hover:bg-bg-surface-raised font-semibold"
                      >
                        Unblock
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
