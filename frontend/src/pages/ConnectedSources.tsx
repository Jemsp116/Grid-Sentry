import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  fetchApiKeys,
  revokeApiKey,
  type ApiKeyItem,
} from '../api/apiKeys.js';
import ConnectSourceWizard from '../components/ConnectSourceWizard.js';

export default function ConnectedSources() {
  const { authFetch, user } = useAuth();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Wizard modal state
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Revoke modal state
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKeyItem | null>(null);
  const [revoking, setRevoking] = useState(false);

  const isAdmin = user?.role === 'admin';

  const loadKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchApiKeys(authFetch);
      setKeys(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleConfirmRevoke = async () => {
    if (!keyToRevoke) return;
    try {
      setRevoking(true);
      await revokeApiKey(authFetch, keyToRevoke.id);
      setKeyToRevoke(null);
      loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRevoking(false);
    }
  };

  function getSourceStatus(k: ApiKeyItem): { label: string; style: string; dot: string } {
    if (!k.is_active) {
      return {
        label: 'Revoked',
        style: 'border-border-default text-text-disabled bg-bg-base',
        dot: 'bg-text-disabled',
      };
    }

    if (!k.last_used_at && !k.first_event_at) {
      return {
        label: 'Waiting for Data',
        style: 'border-accent-primary/40 text-accent-primary bg-accent-primary/10',
        dot: 'bg-accent-primary animate-pulse',
      };
    }

    const lastUsedMs = k.last_used_at ? new Date(k.last_used_at).getTime() : 0;
    const hoursSince = (Date.now() - lastUsedMs) / (1000 * 60 * 60);

    if (hoursSince <= 24) {
      return {
        label: 'Active',
        style: 'border-severity-resolved text-severity-resolved bg-severity-resolved/10',
        dot: 'bg-severity-resolved',
      };
    }

    return {
      label: 'No Recent Data',
      style: 'border-severity-medium text-severity-medium bg-severity-medium/10',
      dot: 'bg-severity-medium',
    };
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-text-primary">Connected Sources</h1>
            <span className="rounded bg-accent-primary/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-accent-primary border border-accent-primary/30">
              LOG INGESTION
            </span>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Manage projects, applications, and log-shipping agents streaming telemetry into Grid Sentry.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsWizardOpen(true)}
            className="flex items-center justify-center gap-2 rounded-lg bg-accent-primary px-4 py-2.5 text-xs font-semibold text-bg-base hover:opacity-90 transition-opacity shadow-sm"
          >
            <span>+</span>
            <span>Connect a Project</span>
          </button>
        )}
      </div>

      {error && (
        <div className="rounded border border-severity-critical/30 bg-severity-critical/10 p-4 text-xs text-severity-critical">
          {error}
        </div>
      )}

      {/* ── Quick Integration Banner ────────────────────────────────────────── */}
      <div className="rounded-xl border border-accent-primary/30 bg-bg-surface p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
            <span>⚡</span> Connect Any Project in Under 1 Minute
          </h2>
          <p className="text-xs text-text-secondary max-w-2xl">
            Whether you have developers who can add 3 lines of code (Node.js, Python, Go, PHP) or non-technical teams who want to point our log shipper at existing files — get instant live connection feedback.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsWizardOpen(true)}
            className="shrink-0 rounded-lg border border-accent-primary bg-accent-primary/15 px-4 py-2 text-xs font-semibold text-accent-primary hover:bg-accent-primary/25 transition-colors"
          >
            Launch Setup Wizard →
          </button>
        )}
      </div>

      {/* ── Connected Sources Table ────────────────────────────────────────── */}
      <div className="rounded-xl border border-border-default bg-bg-surface overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border-default bg-bg-surface-raised/40 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
            Connected Projects & Sources ({keys.length})
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
          </div>
        ) : keys.length === 0 ? (
          <div className="p-16 text-center text-xs text-text-secondary space-y-3">
            <p className="text-sm text-text-primary font-medium">No connected sources yet.</p>
            <p className="max-w-md mx-auto">
              Click <strong>"Connect a Project"</strong> to generate your first project-scoped API key and start streaming logs into your SOC dashboard.
            </p>
            {isAdmin && (
              <button
                onClick={() => setIsWizardOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-accent-primary px-4 py-2 text-xs font-semibold text-bg-base hover:opacity-90 transition-opacity"
              >
                + Connect Your First Project
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border-default bg-bg-surface-raised font-mono text-text-secondary uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3">Project / App</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">First Seen</th>
                  <th className="px-5 py-3">Last Telemetry</th>
                  {isAdmin && <th className="px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {keys.map((k) => {
                  const status = getSourceStatus(k);
                  return (
                    <tr key={k.id} className="hover:bg-bg-surface-raised/50 transition-colors">
                      {/* Project Name */}
                      <td className="px-5 py-3.5 font-medium text-text-primary">
                        <div className="flex items-center gap-2">
                          <span className="text-base">📦</span>
                          <div>
                            <span className="font-semibold text-sm">{k.app_name}</span>
                            <span className="block font-mono text-[10px] text-text-secondary">
                              ID: #{k.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-mono font-medium ${status.style}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                      </td>

                      {/* Method */}
                      <td className="px-5 py-3.5 font-mono text-xs text-text-secondary">
                        {k.connection_method === 'agent' ? (
                          <span className="flex items-center gap-1">
                            <span>📄</span> Log Shipper Agent
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-accent-primary">
                            <span>💻</span> Code SDK
                          </span>
                        )}
                      </td>

                      {/* First Seen */}
                      <td className="px-5 py-3.5 font-mono text-text-secondary text-[11px]">
                        {k.first_event_at
                          ? new Date(k.first_event_at).toLocaleDateString('en-GB', {
                              month: 'short',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>

                      {/* Last Telemetry */}
                      <td className="px-5 py-3.5 font-mono text-text-secondary text-[11px]">
                        {k.last_used_at
                          ? new Date(k.last_used_at).toLocaleDateString('en-GB', {
                              month: 'short',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Never'}
                      </td>

                      {/* Actions */}
                      {isAdmin && (
                        <td className="px-5 py-3.5 text-right font-sans">
                          {k.is_active ? (
                            <button
                              onClick={() => setKeyToRevoke(k)}
                              className="rounded border border-severity-critical/30 bg-severity-critical/10 px-2.5 py-1 text-xs text-severity-critical hover:bg-severity-critical/20 transition-colors"
                            >
                              Revoke
                            </button>
                          ) : (
                            <span className="text-text-disabled text-xs font-mono">Revoked</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Guided Wizard Modal ────────────────────────────────────────────── */}
      <ConnectSourceWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSuccess={loadKeys}
      />

      {/* ── Confirm Revoke Modal ───────────────────────────────────────────── */}
      {keyToRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border-default bg-bg-surface p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-semibold text-severity-critical flex items-center gap-2">
              <span>⚠</span> Revoke Project Source
            </h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Are you sure you want to revoke credentials for{' '}
              <strong className="text-text-primary font-mono">{keyToRevoke.app_name}</strong>? Any application or agent using this API key will immediately be denied from streaming logs into Grid Sentry.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setKeyToRevoke(null)}
                className="rounded-lg border border-border-default px-4 py-2 text-xs font-medium text-text-secondary hover:bg-bg-surface-raised transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                disabled={revoking}
                className="rounded-lg bg-severity-critical px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {revoking ? 'Revoking…' : 'Confirm Revocation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
