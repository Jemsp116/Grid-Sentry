import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  fetchTenantDbStatus,
  connectTenantDb,
  disconnectTenantDb,
  type TenantDbStatus,
} from '../api/tenantDb.js';

export default function DatabaseSettings() {
  const { authFetch } = useAuth();
  const [statusData, setStatusData] = useState<TenantDbStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connStringInput, setConnStringInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  const loadStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchTenantDbStatus(authFetch);
      setStatusData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connStringInput.trim()) return;

    try {
      setConnecting(true);
      setError(null);
      setSuccessMsg(null);
      const updated = await connectTenantDb(authFetch, connStringInput.trim());
      setStatusData(updated);
      setConnStringInput('');
      setSuccessMsg('Successfully connected and verified tenant MongoDB database!');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true);
      setError(null);
      setSuccessMsg(null);
      await disconnectTenantDb(authFetch);
      setShowDisconnectModal(false);
      await loadStatus();
      setSuccessMsg('Tenant database disconnected successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Database Settings (Bring Your Own MongoDB)</h1>
        <p className="mt-1 text-xs text-text-secondary">
          Optionally connect your private MongoDB cluster to store alert feeds, detection rules, and audit logs.
        </p>
      </div>

      {error && (
        <div className="rounded border border-severity-critical/30 bg-severity-critical/10 p-4 text-xs text-severity-critical">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded border border-severity-low/30 bg-severity-low/10 p-4 text-xs text-severity-low">
          {successMsg}
        </div>
      )}

      {/* Current Status Card */}
      <div className="rounded-lg border border-border-default bg-bg-surface p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Connection Status</h2>
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
          ) : statusData?.connection_status === 'verified' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-severity-low/10 px-3 py-1 text-xs font-medium text-severity-low">
              <span className="h-2 w-2 rounded-full bg-severity-low" />
              Verified & Active
            </span>
          ) : statusData?.connection_status === 'failed' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-severity-critical/10 px-3 py-1 text-xs font-medium text-severity-critical">
              <span className="h-2 w-2 rounded-full bg-severity-critical" />
              Connection Failed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-text-secondary/10 px-3 py-1 text-xs font-medium text-text-secondary">
              <span className="h-2 w-2 rounded-full bg-text-secondary" />
              Not Configured (Using Shared DB)
            </span>
          )}
        </div>

        {statusData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono pt-2 border-t border-border-default">
            <div>
              <span className="text-text-secondary">Status:</span>{' '}
              <span className="text-text-primary uppercase font-bold">{statusData.connection_status}</span>
            </div>
            <div>
              <span className="text-text-secondary">Last Verified:</span>{' '}
              <span className="text-text-primary">
                {statusData.last_verified_at ? new Date(statusData.last_verified_at).toLocaleString() : 'N/A'}
              </span>
            </div>
          </div>
        )}

        {statusData?.connection_status === 'verified' && (
          <div className="pt-2 flex justify-end">
            <button
              onClick={() => setShowDisconnectModal(true)}
              className="rounded border border-severity-critical/30 bg-severity-critical/10 px-3.5 py-1.5 text-xs font-medium text-severity-critical hover:bg-severity-critical/20 transition-colors"
            >
              Disconnect My MongoDB
            </button>
          </div>
        )}
      </div>

      {/* Connect Form Card */}
      <div className="rounded-lg border border-border-default bg-bg-surface p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">
          {statusData?.connection_status === 'verified' ? 'Update MongoDB Connection' : 'Connect Your MongoDB Instance'}
        </h2>
        <p className="text-xs text-text-secondary leading-relaxed">
          Provide your MongoDB connection string (e.g. <code className="font-mono text-accent-primary">mongodb+srv://user:pass@cluster.mongodb.net/soc_db</code>). Credentials are encrypted using AES-256-GCM KMS master keys and strictly guarded against SSRF attacks on internal networks.
        </p>

        <form onSubmit={handleConnect} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              MongoDB Connection URI
            </label>
            <input
              type="password"
              required
              placeholder="mongodb+srv://<username>:<password>@<host>/<database>"
              value={connStringInput}
              onChange={(e) => setConnStringInput(e.target.value)}
              className="w-full rounded border border-border-default bg-bg-surface-raised px-3.5 py-2 text-xs font-mono text-text-primary placeholder:text-text-secondary/40 focus:border-accent-primary focus:outline-none"
            />
          </div>

          <div className="rounded border border-accent-primary/20 bg-accent-primary/5 p-3 text-[11px] text-text-secondary space-y-1">
            <p className="font-semibold text-accent-primary">🔒 Security Architecture Guarantees:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Raw connection strings are NEVER logged in server or error logs.</li>
              <li>Connection attempts to internal or private IP addresses (127.0.0.1, 10.x, 192.168.x) are automatically blocked.</li>
              <li>Credentials are stored using AES-256-GCM KMS authenticated encryption.</li>
            </ul>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={connecting || !connStringInput.trim()}
              className="flex items-center gap-2 rounded bg-accent-primary px-4 py-2 text-xs font-medium text-text-inverse hover:bg-accent-primary/90 disabled:opacity-50 transition-colors"
            >
              {connecting && <div className="h-3 w-3 animate-spin rounded-full border-2 border-text-inverse border-t-transparent" />}
              {connecting ? 'Testing Connection...' : 'Test & Connect Database'}
            </button>
          </div>
        </form>
      </div>

      {/* Architecture Info Card */}
      <div className="rounded-lg border border-border-default bg-bg-surface-raised p-5 text-xs space-y-2 text-text-secondary">
        <h3 className="font-semibold text-text-primary flex items-center gap-2">
          <span>⚙</span> Telemetry & Data Separation Architecture
        </h3>
        <p>
          Connecting your private MongoDB directs all <strong>connected source telemetry logs</strong> (under <code className="font-mono text-accent-primary">source_logs</code>), <strong>alert feeds</strong>, <strong>detection rules</strong>, and <strong>audit trails</strong> directly into your own database cluster.
        </p>
        <p>
          Grid Sentry's central database strictly maintains only project connection credentials, active status, and aggregate event counters.
        </p>
      </div>

      {/* Disconnect Modal */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-lg border border-border-default bg-bg-surface p-6 shadow-xl space-y-4">
            <h2 className="text-base font-semibold text-text-primary">Disconnect Tenant Database</h2>
            <p className="text-xs text-text-secondary">
              Are you sure you want to disconnect your MongoDB instance? Grid Sentry will immediately stop connecting to your database and fall back to the default shared database.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDisconnectModal(false)}
                className="rounded border border-border-default px-3.5 py-1.5 text-xs text-text-secondary hover:bg-bg-surface-raised transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="rounded bg-severity-critical px-3.5 py-1.5 text-xs font-medium text-white hover:bg-severity-critical/90 disabled:opacity-50 transition-colors"
              >
                {disconnecting ? 'Disconnecting...' : 'Confirm Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
