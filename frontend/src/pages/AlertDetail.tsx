import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import {
  fetchAlertById,
  updateAlertStatus,
  fetchAlertNotes,
  addAlertNote,
  fetchAlertRawLogs,
  fetchIpThreatIntel,
  type Alert,
  type AlertNote,
  type RawEvidenceLog,
  type AlertStatus,
  type ThreatIntelData,
} from '../api/alerts.js';

const STATUSES: Array<{ value: AlertStatus; label: string; badgeCls: string }> = [
  { value: 'new', label: 'New', badgeCls: 'border-accent-primary text-accent-primary bg-accent-primary/10' },
  { value: 'investigating', label: 'Investigating', badgeCls: 'border-severity-high text-severity-high bg-severity-high/10' },
  { value: 'resolved', label: 'Resolved', badgeCls: 'border-severity-resolved text-severity-resolved bg-severity-resolved/10' },
  { value: 'false_positive', label: 'False Positive', badgeCls: 'border-text-disabled text-text-secondary bg-bg-surface-raised' },
];

export default function AlertDetail() {
  const { id } = useParams<{ id: string }>();
  const alertId = parseInt(id ?? '', 10);
  const navigate = useNavigate();
  const { authFetch, user } = useAuth();
  const canWrite = user?.role === 'analyst' || user?.role === 'admin';

  const [alert, setAlert] = useState<Alert | null>(null);
  const [notes, setNotes] = useState<AlertNote[]>([]);
  const [rawLogs, setRawLogs] = useState<RawEvidenceLog[]>([]);

  // Threat Intel state
  const [intel, setIntel] = useState<ThreatIntelData | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelError, setIntelError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status update
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // New note form
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (isNaN(alertId)) {
      setError('Invalid alert ID');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [alertData, notesData, logsData] = await Promise.all([
        fetchAlertById(authFetch, alertId),
        fetchAlertNotes(authFetch, alertId),
        fetchAlertRawLogs(authFetch, alertId),
      ]);
      setAlert(alertData);
      setNotes(notesData);
      setRawLogs(logsData);

      // On-demand threat intel lookup for source_ip
      if (alertData.source_ip) {
        setIntelLoading(true);
        fetchIpThreatIntel(authFetch, alertData.source_ip)
          .then(setIntel)
          .catch((err) => setIntelError(err instanceof Error ? err.message : 'Intel lookup failed'))
          .finally(() => setIntelLoading(false));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alert details');
    } finally {
      setLoading(false);
    }
  }, [authFetch, alertId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleStatusChange(newStatus: AlertStatus) {
    if (!alert || !canWrite) return;
    setUpdatingStatus(true);
    try {
      const updated = await updateAlertStatus(authFetch, alert.id, newStatus);
      setAlert(updated);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newNote.trim() || !alert || !canWrite) return;

    setAddingNote(true);
    setNoteError(null);
    try {
      const createdNote = await addAlertNote(authFetch, alert.id, newNote.trim());
      setNotes((prev) => [...prev, createdNote]);
      setNewNote('');
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : 'Failed to post note');
    } finally {
      setAddingNote(false);
    }
  }

  function formatTimestamp(ts?: string): string {
    if (!ts) return '—';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div>
        <button
          onClick={() => navigate('/alerts')}
          className="mb-4 text-xs text-accent-primary hover:underline"
        >
          ← Back to Alert Feed
        </button>
        <div className="rounded border border-severity-critical/30 bg-severity-critical/5 p-6 text-severity-critical">
          {error ?? 'Alert not found'}
        </div>
      </div>
    );
  }

  const stInfo = STATUSES.find((s) => s.value === alert.status);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/alerts')}
        className="text-xs text-accent-primary hover:underline"
      >
        ← Back to Alert Feed
      </button>

      {/* Top Banner Header */}
      <div
        className={`rounded-card border border-border-default bg-bg-surface p-6 ${
          alert.severity === 'critical'
            ? 'severity-rail border-l-severity-critical'
            : alert.severity === 'high'
              ? 'severity-rail border-l-severity-high'
              : alert.severity === 'medium'
                ? 'severity-rail border-l-severity-medium'
                : 'severity-rail border-l-severity-low'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-text-secondary">Alert #{alert.id}</span>
              <span className="uppercase tracking-wide font-mono text-xs font-semibold text-severity-critical">
                {alert.severity}
              </span>
            </div>
            <h1 className="mt-1 text-xl font-semibold text-text-primary">{alert.rule_name}</h1>
            <p className="mt-1 text-xs text-text-secondary">
              Source IP: <span className="font-mono text-text-primary">{alert.source_ip}</span> · Triggered At: <span className="font-mono text-text-primary">{formatTimestamp(alert.created_at)}</span>
            </p>
          </div>

          {/* Status Selector Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">Status:</span>
            {canWrite ? (
              <select
                value={alert.status}
                disabled={updatingStatus}
                onChange={(e) => handleStatusChange(e.target.value as AlertStatus)}
                className={`rounded border px-3 py-1.5 font-mono text-xs font-semibold focus:outline-none ${stInfo?.badgeCls}`}
              >
                {STATUSES.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className={`rounded border px-3 py-1 font-mono text-xs ${stInfo?.badgeCls}`}>
                {stInfo?.label}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Columns: Threat Intel + Rule Info + Raw Evidence Logs */}
        <div className="space-y-6 lg:col-span-2">
          {/* Threat Intelligence Enrichment Card */}
          <div className="rounded-card border border-border-default bg-bg-surface p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                  <span>Threat Intelligence Enrichment</span>
                  {intel && (
                    <span
                      className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase font-bold ${
                        intel.riskLevel === 'critical'
                          ? 'border-severity-critical text-severity-critical bg-severity-critical/10'
                          : intel.riskLevel === 'high'
                            ? 'border-severity-high text-severity-high bg-severity-high/10'
                            : intel.riskLevel === 'medium'
                              ? 'border-severity-medium text-severity-medium bg-severity-medium/10'
                              : 'border-severity-resolved text-severity-resolved bg-severity-resolved/10'
                      }`}
                    >
                      {intel.riskLevel} Risk
                    </span>
                  )}
                </h2>
                <p className="text-xs text-text-secondary">
                  On-demand reputation & threat metrics for source IP <span className="font-mono text-text-primary">{alert.source_ip}</span>
                </p>
              </div>

              {intel && (
                <span className="rounded border border-border-default bg-bg-base px-2 py-1 font-mono text-[10px] text-text-secondary">
                  Source: {intel.source === 'abuseipdb' ? 'AbuseIPDB Live API' : 'Threat Intel (Demo / Cached)'}
                </span>
              )}
            </div>

            {intelLoading ? (
              <div className="flex h-24 items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
              </div>
            ) : intelError ? (
              <div className="rounded border border-severity-medium/30 bg-severity-medium/5 p-3 text-xs text-severity-medium">
                Enrichment unavailable: {intelError}
              </div>
            ) : intel ? (
              <div className="space-y-4 text-xs">
                {/* Score Progress Bar */}
                <div className="rounded border border-border-default bg-bg-base p-4">
                  <div className="mb-1.5 flex items-center justify-between font-mono">
                    <span className="text-text-secondary">Abuse Confidence Score</span>
                    <span className="font-bold text-text-primary">{intel.abuseConfidenceScore}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-bg-surface">
                    <div
                      className={`h-full transition-all ${
                        intel.abuseConfidenceScore >= 80
                          ? 'bg-severity-critical'
                          : intel.abuseConfidenceScore >= 50
                            ? 'bg-severity-high'
                            : intel.abuseConfidenceScore >= 20
                              ? 'bg-severity-medium'
                              : 'bg-severity-resolved'
                      }`}
                      style={{ width: `${intel.abuseConfidenceScore}%` }}
                    />
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded border border-border-default bg-bg-base p-3">
                    <span className="text-[11px] text-text-secondary block">Total Abuse Reports</span>
                    <span className="font-mono text-sm font-bold text-severity-high">{intel.totalReports}</span>
                  </div>

                  <div className="rounded border border-border-default bg-bg-base p-3">
                    <span className="text-[11px] text-text-secondary block">ISP / Organization</span>
                    <span className="font-mono text-xs font-semibold text-text-primary truncate block">{intel.isp}</span>
                  </div>

                  <div className="rounded border border-border-default bg-bg-base p-3">
                    <span className="text-[11px] text-text-secondary block">Origin Country</span>
                    <span className="font-mono text-xs font-semibold text-text-primary block">
                      [{intel.countryCode}] {intel.countryName}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-text-secondary border-t border-border-default pt-2">
                  <span>Usage Type: <strong className="text-text-primary">{intel.usageType}</strong></span>
                  <span>Whitelisted: <strong className="text-text-primary">{intel.isWhitelisted ? 'Yes' : 'No'}</strong></span>
                  <span>Cache TTL: <strong className="text-text-primary">24h</strong></span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Matched Rule Summary */}
          <div className="rounded-card border border-border-default bg-bg-surface p-6">
            <h2 className="mb-4 text-base font-semibold text-text-primary">Matched Rule Details</h2>
            <div className="grid gap-4 sm:grid-cols-2 text-xs">
              <div>
                <span className="text-text-secondary">Rule Name:</span>
                <p className="font-semibold text-text-primary">{alert.rule_name}</p>
              </div>
              <div>
                <span className="text-text-secondary">MITRE Technique ID:</span>
                <p className="font-mono text-accent-primary">{alert.mitre_technique_id ?? '—'}</p>
              </div>
              <div>
                <span className="text-text-secondary">Log Source:</span>
                <p className="font-mono text-text-primary">{alert.log_source}</p>
              </div>
              <div>
                <span className="text-text-secondary">Threshold / Window:</span>
                <p className="font-mono text-text-primary">≥{alert.threshold} in {alert.time_window_seconds}s</p>
              </div>
              <div>
                <span className="text-text-secondary">Action on Trigger:</span>
                <p className="font-mono text-severity-critical">
                  {alert.action_on_trigger === 'alert_and_block_ip' ? 'Alert & Block IP' : 'Alert Only'}
                </p>
              </div>
              <div>
                <span className="text-text-secondary">Target Host:</span>
                <p className="font-mono text-text-primary">{alert.target_host ?? '—'}</p>
              </div>
            </div>
            {alert.rule_description && (
              <p className="mt-4 border-t border-border-default pt-3 text-xs text-text-secondary">
                {alert.rule_description}
              </p>
            )}
          </div>

          {/* Raw Evidence Logs */}
          <div className="rounded-card border border-border-default bg-bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-text-primary">Raw Evidence Logs</h2>
              <span className="font-mono text-xs text-text-secondary">{rawLogs.length} logs retrieved</span>
            </div>

            {rawLogs.length === 0 ? (
              <p className="text-xs text-text-secondary">No raw evidence log documents retrieved.</p>
            ) : (
              <div className="space-y-3">
                {rawLogs.map((log, idx) => (
                  <div
                    key={log._id || idx}
                    className="rounded border border-border-default bg-bg-base p-3 space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-text-secondary">
                      <span>{formatTimestamp(log._source['@timestamp'] as string)}</span>
                      <span>IP: <strong className="text-text-primary">{log._source.source_ip as string ?? '—'}</strong></span>
                      <span>User: <strong className="text-text-primary">{log._source.ssh_user as string ?? '—'}</strong></span>
                      <span className={log._source.outcome === 'failure' ? 'text-severity-critical font-bold' : 'text-severity-resolved font-bold'}>
                        {log._source.outcome as string ?? '—'}
                      </span>
                    </div>

                    <pre className="overflow-x-auto font-mono text-xs text-text-primary whitespace-pre-wrap break-words">
                      {(log._source.raw_message as string) ?? JSON.stringify(log._source)}
                    </pre>

                    <details className="text-[10px]">
                      <summary className="cursor-pointer text-text-secondary hover:text-text-primary">
                        Document source (ID: {log._id})
                      </summary>
                      <pre className="mt-1 overflow-x-auto font-mono text-text-secondary p-2 bg-bg-surface rounded">
                        {JSON.stringify(log._source, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Column: Notes Conversation Thread */}
        <div className="rounded-card border border-border-default bg-bg-surface p-6 flex flex-col h-fit">
          <h2 className="mb-4 text-base font-semibold text-text-primary">Investigation Notes</h2>

          {/* Notes Conversation Stream */}
          <div className="space-y-3 mb-6 max-h-[400px] overflow-y-auto">
            {notes.length === 0 ? (
              <p className="text-xs text-text-secondary">No investigation notes added yet.</p>
            ) : (
              notes.map((n) => (
                <div key={n.id} className="rounded border border-border-default bg-bg-base p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-text-secondary">
                    <span className="font-mono font-medium text-accent-primary">{n.user_email}</span>
                    <span>{formatTimestamp(n.created_at)}</span>
                  </div>
                  <p className="text-text-primary whitespace-pre-wrap break-words">{n.note}</p>
                </div>
              ))
            )}
          </div>

          {/* Add Note Form */}
          {canWrite ? (
            <form onSubmit={handleAddNote} className="border-t border-border-default pt-4">
              {noteError && (
                <p className="mb-2 text-xs text-severity-critical">{noteError}</p>
              )}
              <label className="mb-1 block text-xs text-text-secondary">Append Note *</label>
              <textarea
                rows={3}
                required
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Enter investigation observations or triage notes..."
                className="w-full rounded border border-border-default bg-bg-base p-2 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
              />
              <button
                type="submit"
                disabled={addingNote || !newNote.trim()}
                className="mt-2 w-full rounded bg-accent-primary py-2 text-xs font-semibold text-bg-base transition-opacity disabled:opacity-50"
              >
                {addingNote ? 'Posting…' : 'Add Note'}
              </button>
            </form>
          ) : (
            <p className="border-t border-border-default pt-4 text-xs text-text-secondary">
              Sign in as Analyst or Admin to add investigation notes.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
