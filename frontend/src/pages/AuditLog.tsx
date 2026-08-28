import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  fetchAuditLogs,
  type AuditLogRow,
  type AuditLogsResponse,
} from '../api/audit.js';
import Pagination from '../components/Pagination.js';

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'auth.login_success', label: 'Auth Login Success' },
  { value: 'auth.logout', label: 'Auth Logout' },
  { value: 'rule.created', label: 'Rule Created' },
  { value: 'rule.updated', label: 'Rule Updated' },
  { value: 'rule.toggled', label: 'Rule Toggled' },
  { value: 'rule.deleted', label: 'Rule Deleted' },
  { value: 'alert.status_updated', label: 'Alert Status Updated' },
  { value: 'alert.note_added', label: 'Alert Note Added' },
  { value: 'user.created', label: 'User Created' },
  { value: 'user.suspended', label: 'User Suspended' },
  { value: 'user.reactivated', label: 'User Reactivated' },
  { value: 'user.role_updated', label: 'User Role Updated' },
  { value: 'blocklist.ip_blocked', label: 'IP Blocked (Manual)' },
  { value: 'blocklist.ip_unblocked', label: 'IP Unblocked' },
  { value: 'blocklist.ip_autoblocked', label: 'IP Auto-Blocked (Rule)' },
];

const TARGET_TYPES = [
  { value: '', label: 'All Targets' },
  { value: 'user', label: 'User' },
  { value: 'rule', label: 'Rule' },
  { value: 'alert', label: 'Alert' },
  { value: 'ip_blocklist', label: 'IP Blocklist' },
];

export default function AuditLog() {
  const { authFetch, user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [data, setData] = useState<AuditLogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  // Details drawer
  const [selectedEntry, setSelectedEntry] = useState<AuditLogRow | null>(null);

  const loadAuditLogs = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAuditLogs(authFetch, {
        action: actionFilter || undefined,
        targetType: targetTypeFilter || undefined,
        from: fromDate ? new Date(fromDate).toISOString() : undefined,
        to: toDate ? new Date(toDate).toISOString() : undefined,
        page,
        pageSize: 50,
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [authFetch, isAdmin, actionFilter, targetTypeFilter, fromDate, toDate, page]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  function handleClearFilters() {
    setActionFilter('');
    setTargetTypeFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  }

  function formatTimestamp(ts: string): string {
    try {
      return new Date(ts).toLocaleString('en-GB', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      });
    } catch {
      return ts;
    }
  }

  function getActionBadgeStyle(action: string): string {
    if (action.startsWith('auth.')) return 'border-accent-primary text-accent-primary bg-accent-primary/10';
    if (action.includes('suspended') || action.includes('deleted') || action.includes('blocked')) {
      return 'border-severity-critical text-severity-critical bg-severity-critical/10';
    }
    if (action.includes('created') || action.includes('reactivated') || action.includes('unblocked')) {
      return 'border-severity-resolved text-severity-resolved bg-severity-resolved/10';
    }
    return 'border-severity-medium text-severity-medium bg-severity-medium/10';
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center rounded-card border border-border-default bg-bg-surface py-20 text-center">
        <div className="mb-4 text-4xl text-severity-critical">🔒</div>
        <h2 className="text-lg font-semibold text-text-primary">Access Restricted</h2>
        <p className="mt-1 max-w-md text-xs text-text-secondary">
          Viewing system audit logs requires Admin role permissions. Please contact an administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Audit Log</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Immutable audit trail recording administrative, security, and rule modification actions.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="grid gap-3 rounded-card border border-border-default bg-bg-surface p-4 text-xs sm:grid-cols-2 lg:grid-cols-5">
        {/* Action filter */}
        <div>
          <label className="mb-1 block text-text-secondary">Action Type</label>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="w-full rounded border border-border-default bg-bg-base px-2.5 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
          >
            {ACTION_TYPES.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        {/* Target filter */}
        <div>
          <label className="mb-1 block text-text-secondary">Target Type</label>
          <select
            value={targetTypeFilter}
            onChange={(e) => { setTargetTypeFilter(e.target.value); setPage(1); }}
            className="w-full rounded border border-border-default bg-bg-base px-2.5 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
          >
            {TARGET_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* From Date */}
        <div>
          <label className="mb-1 block text-text-secondary">From Date</label>
          <input
            type="datetime-local"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            className="w-full rounded border border-border-default bg-bg-base px-2.5 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
          />
        </div>

        {/* To Date */}
        <div>
          <label className="mb-1 block text-text-secondary">To Date</label>
          <input
            type="datetime-local"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            className="w-full rounded border border-border-default bg-bg-base px-2.5 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
          />
        </div>

        {/* Clear */}
        <div className="flex items-end">
          <button
            onClick={handleClearFilters}
            className="w-full rounded border border-border-default bg-bg-base py-1.5 text-xs text-text-secondary hover:bg-bg-surface-raised hover:text-text-primary"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-severity-critical/30 bg-severity-critical/5 px-4 py-3 text-sm text-severity-critical">
          {error}
        </div>
      )}

      {/* Audit Log Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
        </div>
      ) : !data || data.logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-card border border-border-default bg-bg-surface py-20">
          <div className="mb-4 text-4xl opacity-30">📋</div>
          <h3 className="text-sm font-semibold text-text-primary">No audit log entries found</h3>
          <p className="mt-1 text-xs text-text-secondary">
            No matching events correspond to the active filter criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-card border border-border-default">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border-default bg-bg-surface text-text-secondary">
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">Performer</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-border-default bg-bg-surface font-mono transition-colors hover:bg-bg-surface-raised"
                    style={{ minHeight: '44px' }}
                  >
                    {/* Timestamp */}
                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                      {formatTimestamp(log.created_at)}
                    </td>

                    {/* Performer */}
                    <td className="whitespace-nowrap px-4 py-3 text-text-primary">
                      {log.user_email ? (
                        <span>{log.user_email}</span>
                      ) : (
                        <span className="text-accent-primary font-bold">⚡ SYSTEM</span>
                      )}
                    </td>

                    {/* Action Badge */}
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`rounded border px-2 py-0.5 text-[11px] ${getActionBadgeStyle(log.action)}`}>
                        {log.action}
                      </span>
                    </td>

                    {/* Target */}
                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                      <span className="uppercase text-text-primary font-semibold">{log.target_type}</span>
                      {log.target_id && <span className="ml-1 text-text-secondary">#{log.target_id}</span>}
                    </td>

                    {/* Details button */}
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {log.details ? (
                        <button
                          onClick={() => setSelectedEntry(log)}
                          className="rounded border border-border-default px-2.5 py-1 text-[11px] text-accent-primary hover:bg-bg-base"
                        >
                          Inspect JSON
                        </button>
                      ) : (
                        <span className="text-text-disabled">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* JSON Details Drawer Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 p-4">
          <div className="w-full max-w-xl rounded-modal border border-border-default bg-bg-surface-raised p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-default pb-3">
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  Audit Entry Details #{selectedEntry.id}
                </h2>
                <p className="font-mono text-xs text-text-secondary">
                  {selectedEntry.action} · {formatTimestamp(selectedEntry.created_at)}
                </p>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="rounded p-1 text-text-secondary hover:bg-bg-surface hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-text-secondary">Raw JSON Details</label>
              <pre className="max-h-80 overflow-y-auto rounded border border-border-default bg-bg-base p-4 font-mono text-xs text-accent-primary">
                {JSON.stringify(selectedEntry.details, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end border-t border-border-default pt-3">
              <button
                onClick={() => setSelectedEntry(null)}
                className="rounded bg-accent-primary px-4 py-1.5 text-xs font-semibold text-bg-base hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
