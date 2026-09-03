/**
 * Log Explorer — dual-mode log viewer.
 *
 * MODE A — "All Sources" selected:
 *   Searches the OpenSearch SIEM engine across all ingested log events.
 *
 * MODE B — A specific connected source is selected:
 *   Fetches RAW logs directly from that source's private BYODB (tenant MongoDB).
 *   Falls back to OpenSearch filtered by the source's app_name if BYODB is not configured.
 *   Shows all the actual event data (event_type, user, details, raw_message) as sent
 *   by the connected website/app via the Grid Sentry SDK.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  searchLogs,
  fetchSourceRawLogs,
  type LogEntry,
  type LogSearchParams,
  type LogSearchResponse,
  type TenantSourceLog,
  type TenantSourceLogsResponse,
} from '../api/logs.js';
import { ALL_SOURCES_ID, useSource } from '../context/SourceContext.js';
import Pagination from '../components/Pagination.js';
import SourceSelector from '../components/SourceSelector.js';

// ─── Time-range presets ─────────────────────────────────────────────────────

const TIME_PRESETS = [
  { label: 'Last 1h', ms: 60 * 60 * 1000 },
  { label: 'Last 6h', ms: 6 * 60 * 60 * 1000 },
  { label: 'Last 24h', ms: 24 * 60 * 60 * 1000 },
  { label: 'Last 7d', ms: 7 * 24 * 60 * 60 * 1000 },
  { label: 'All time', ms: 0 },
] as const;

const PAGE_SIZE = 50;

function formatTs(ts: string | null | undefined): string {
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

// ─── Event-type badge color ──────────────────────────────────────────────────
function eventTypeBadge(eventType: string): string {
  const et = eventType.toLowerCase();
  if (et.includes('error') || et.includes('fail') || et.includes('denied'))
    return 'bg-severity-critical/15 text-severity-critical border-severity-critical/30';
  if (et.includes('warn') || et.includes('suspicious'))
    return 'bg-severity-high/15 text-severity-high border-severity-high/30';
  if (et.includes('login') || et.includes('auth') || et.includes('success'))
    return 'bg-severity-resolved/15 text-severity-resolved border-severity-resolved/30';
  return 'bg-bg-surface-raised text-text-secondary border-border-default';
}

// ══════════════════════════════════════════════════════════════════════════════
// SOURCE LOG VIEW  (Mode B — specific source selected)
// ══════════════════════════════════════════════════════════════════════════════

function SourceLogView() {
  const { authFetch } = useAuth();
  const { selectedSource } = useSource();

  const [keyword, setKeyword] = useState('');
  const [eventType, setEventType] = useState('');
  const [filterIp, setFilterIp] = useState('');

  const [result, setResult] = useState<TenantSourceLogsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detail panel
  const [selected, setSelected] = useState<TenantSourceLog | null>(null);

  const doFetch = useCallback(
    async (p: number = 1) => {
      if (!selectedSource) return;
      setLoading(true);
      setError(null);
      try {
        const data = await fetchSourceRawLogs(
          authFetch,
          selectedSource.id,
          selectedSource.app_name,
          p,
          PAGE_SIZE,
          keyword.trim() || undefined,
          eventType.trim() || undefined,
          filterIp.trim() || undefined,
        );
        setResult(data);
        setSelected(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch source logs');
      } finally {
        setLoading(false);
      }
    },
    [authFetch, selectedSource, keyword, eventType, filterIp],
  );

  useEffect(() => {
    setResult(null);
    setSelected(null);
    doFetch(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSource?.id]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSelected(null);
    doFetch(1);
  }

  function handleReset() {
    setKeyword('');
    setEventType('');
    setFilterIp('');
    setSelected(null);
  }

  if (!selectedSource) return null;

  const sourceLabel = result?.source === 'user_private_database' ? '🔒 Private MongoDB' : '☁ SIEM Engine';
  const sourceBadge = result?.source === 'user_private_database'
    ? 'border-severity-resolved/40 bg-severity-resolved/10 text-severity-resolved'
    : 'border-border-default bg-bg-surface-raised text-text-secondary';

  return (
    <div className="flex gap-0">
      {/* ── Main panel ───────────────────────────────────────────────────── */}
      <div className={`flex-1 min-w-0 transition-all ${selected ? 'mr-0' : ''}`}>

        {/* Storage source indicator */}
        {result && (
          <div className="mb-4 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold ${sourceBadge}`}>
              {sourceLabel}
            </span>
            <span className="text-xs text-text-disabled">
              {result.source === 'user_private_database'
                ? `Showing raw logs directly from ${selectedSource.app_name}'s private database`
                : `Showing SIEM-indexed logs for ${selectedSource.app_name} (connect a private DB to get direct raw logs)`}
            </span>
          </div>
        )}

        {/* ── Filter bar ─────────────────────────────────────────────────── */}
        <form onSubmit={handleSearch} className="mb-6 rounded-card border border-border-default bg-bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Keyword */}
            <div>
              <label className="mb-1 block text-xs text-text-secondary">Keyword / Search</label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g. login failed, /api/users"
                className="w-full rounded border border-border-default bg-bg-base px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none"
              />
            </div>
            {/* Event Type */}
            <div>
              <label className="mb-1 block text-xs text-text-secondary">Event Type</label>
              <input
                type="text"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                placeholder="e.g. user_login_failed, api_request"
                className="w-full rounded border border-border-default bg-bg-base px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none"
              />
            </div>
            {/* Source IP */}
            <div>
              <label className="mb-1 block text-xs text-text-secondary">Source IP</label>
              <input
                type="text"
                value={filterIp}
                onChange={(e) => setFilterIp(e.target.value)}
                placeholder="e.g. 192.168.1.10"
                className="w-full rounded border border-border-default bg-bg-base px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={handleReset}
              className="rounded border border-border-default px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-surface-raised">
              Reset
            </button>
            <button type="submit" disabled={loading}
              className="rounded bg-accent-primary px-4 py-1.5 text-xs font-semibold text-bg-base transition-opacity disabled:opacity-50">
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-4 rounded border border-severity-critical/30 bg-severity-critical/5 px-4 py-3 text-sm text-severity-critical">
            {error}
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────────────────── */}
        {loading && !result ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
          </div>
        ) : result && result.logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-card border border-border-default bg-bg-surface py-20">
            <div className="mb-4 text-4xl opacity-30">📭</div>
            <h3 className="text-sm font-semibold text-text-primary">No logs from {selectedSource.app_name}</h3>
            <p className="mt-2 max-w-md text-center text-xs text-text-secondary leading-relaxed">
              {result.hasTenantDb
                ? 'Your private database is connected but no events have been received from this source yet. Make sure your app is sending logs using the Grid Sentry SDK.'
                : 'No logs found in the SIEM engine for this source. Integrate the Grid Sentry SDK into your app and start sending events.'}
            </p>
          </div>
        ) : result ? (
          <>
            <div className="mb-3 flex items-center justify-between text-xs text-text-secondary">
              <span>
                {loading ? 'Updating…' : `Showing ${result.logs.length} of `}
                {!loading && <span className="font-mono text-text-primary">{result.total.toLocaleString()}</span>}
                {!loading && ' events'}
              </span>
              {loading && <div className="h-3 w-3 animate-spin rounded-full border border-accent-primary border-t-transparent" />}
            </div>

            {/* Log table */}
            <div className="overflow-x-auto rounded-card border border-border-default">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border-default bg-bg-surface text-text-secondary">
                    <th className="px-4 py-3 font-medium">Timestamp</th>
                    <th className="px-4 py-3 font-medium">Event Type</th>
                    <th className="px-4 py-3 font-medium">Source IP</th>
                    <th className="px-4 py-3 font-medium">User / Identifier</th>
                    <th className="px-4 py-3 font-medium">Raw Message</th>
                  </tr>
                </thead>
                <tbody>
                  {result.logs.map((log, idx) => {
                    const isSelected = selected === log;
                    return (
                      <tr
                        key={log._id ?? idx}
                        onClick={() => setSelected(isSelected ? null : log)}
                        className={`cursor-pointer border-b border-border-default transition-colors hover:bg-bg-surface-raised ${
                          isSelected ? 'bg-accent-primary/5' : 'bg-bg-surface'
                        }`}
                        style={{ minHeight: '44px' }}
                      >
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-text-secondary">
                          {formatTs(log.timestamp)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5">
                          <span className={`rounded border px-2 py-0.5 font-mono text-[11px] ${eventTypeBadge(log.event_type)}`}>
                            {log.event_type}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-text-primary">
                          {log.source_ip || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-text-secondary">
                          {log.user_identifier || '—'}
                        </td>
                        <td className="max-w-xs truncate px-4 py-2.5 font-mono text-text-secondary hover:text-text-primary">
                          {log.raw_message || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination page={result.page} totalPages={result.totalPages} onPageChange={(p) => doFetch(p)} />
          </>
        ) : null}
      </div>

      {/* ── Detail panel ─────────────────────────────────────────────────── */}
      {selected && (
        <div
          className="ml-4 w-96 flex-shrink-0 rounded-card border border-border-default bg-bg-surface"
          style={{ animation: 'slideIn 0.2s ease-out' }}
        >
          <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Event Detail</h2>
              <p className="font-mono text-[10px] text-text-disabled">{selectedSource.app_name}</p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="rounded p-1 text-text-secondary transition-colors hover:bg-bg-surface-raised hover:text-text-primary"
            >✕</button>
          </div>

          <div className="max-h-[calc(100vh-220px)] overflow-y-auto p-4 space-y-4">
            {/* Core fields */}
            <div className="space-y-2">
              <DetailField label="Timestamp" value={formatTs(selected.timestamp)} />
              <DetailField label="Event Type" value={selected.event_type} />
              <DetailField label="Source IP" value={selected.source_ip} />
              <DetailField label="User / Identifier" value={selected.user_identifier ?? '—'} />
              <DetailField label="App Name" value={selected.app_name} />
            </div>

            {/* Raw message */}
            <div>
              <h3 className="mb-1.5 text-xs font-medium text-text-secondary">Raw Message</h3>
              <pre className="overflow-x-auto rounded border border-border-default bg-bg-base p-3 font-mono text-xs leading-relaxed text-text-primary whitespace-pre-wrap break-words">
                {selected.raw_message || '(empty)'}
              </pre>
            </div>

            {/* Details / payload */}
            {selected.details && Object.keys(selected.details).length > 0 && (
              <div>
                <h3 className="mb-1.5 text-xs font-medium text-text-secondary">Event Payload / Details</h3>
                <pre className="overflow-x-auto rounded border border-border-default bg-bg-base p-3 font-mono text-[11px] leading-relaxed text-text-secondary whitespace-pre-wrap break-words">
                  {JSON.stringify(selected.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SIEM LOG SEARCH  (Mode A — all sources / OpenSearch)
// ══════════════════════════════════════════════════════════════════════════════

function SiemLogSearch() {
  const { authFetch } = useAuth();

  const [keyword, setKeyword] = useState('');
  const [sourceIp, setSourceIp] = useState('');
  const [outcome, setOutcome] = useState<'' | 'success' | 'failure'>('');
  const [logSource, setLogSource] = useState('');
  const [timePreset, setTimePreset] = useState(2);

  const [result, setResult] = useState<LogSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const doSearch = useCallback(
    async (p: number = 1) => {
      setLoading(true);
      setError(null);
      try {
        const params: LogSearchParams = { page: p, pageSize: PAGE_SIZE };
        if (keyword.trim()) params.q = keyword.trim();
        if (sourceIp.trim()) params.sourceIp = sourceIp.trim();
        if (outcome) params.outcome = outcome;
        if (logSource.trim()) params.logSource = logSource.trim();

        const preset = TIME_PRESETS[timePreset];
        if (preset && preset.ms > 0) {
          params.from = new Date(Date.now() - preset.ms).toISOString();
        }

        const data = await searchLogs(authFetch, params);
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    },
    [authFetch, keyword, sourceIp, outcome, logSource, timePreset],
  );

  useEffect(() => {
    doSearch(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedLog(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function formatTimestamp(entry: LogEntry): string {
    const ts = entry._source['@timestamp'] ?? entry._source.timestamp;
    if (!ts) return '—';
    try {
      return new Date(ts as string).toLocaleString('en-GB', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      });
    } catch { return String(ts); }
  }

  const outcomeColor = (o?: string) => {
    if (o === 'failure') return 'text-severity-critical';
    if (o === 'success') return 'text-severity-resolved';
    return 'text-text-secondary';
  };

  return (
    <div className="flex gap-0">
      <div className={`flex-1 transition-all ${selectedLog ? 'pr-0' : ''}`}>
        {/* Filter bar */}
        <form onSubmit={(e) => { e.preventDefault(); setSelectedLog(null); doSearch(1); }}
          className="mb-6 rounded-card border border-border-default bg-bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="log-keyword" className="mb-1 block text-xs text-text-secondary">Keyword</label>
              <input id="log-keyword" type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g. Failed password"
                className="w-full rounded border border-border-default bg-bg-base px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none" />
            </div>
            <div>
              <label htmlFor="log-source-ip" className="mb-1 block text-xs text-text-secondary">Source IP</label>
              <input id="log-source-ip" type="text" value={sourceIp} onChange={(e) => setSourceIp(e.target.value)}
                placeholder="e.g. 192.168.1.100"
                className="w-full rounded border border-border-default bg-bg-base px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none" />
            </div>
            <div>
              <label htmlFor="log-outcome" className="mb-1 block text-xs text-text-secondary">Outcome</label>
              <select id="log-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as '' | 'success' | 'failure')}
                className="w-full rounded border border-border-default bg-bg-base px-3 py-2 text-xs text-text-primary focus:border-accent-primary focus:outline-none">
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>
            </div>
            <div>
              <label htmlFor="log-source" className="mb-1 block text-xs text-text-secondary">Log Source</label>
              <input id="log-source" type="text" value={logSource} onChange={(e) => setLogSource(e.target.value)}
                placeholder="e.g. ssh_auth"
                className="w-full rounded border border-border-default bg-bg-base px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none" />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {TIME_PRESETS.map((preset, i) => (
                <button key={preset.label} type="button" onClick={() => setTimePreset(i)}
                  className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                    timePreset === i
                      ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                      : 'border-border-default text-text-secondary hover:bg-bg-surface-raised'
                  }`}>
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setKeyword(''); setSourceIp(''); setOutcome(''); setLogSource(''); setTimePreset(2); setSelectedLog(null); }}
                className="rounded border border-border-default px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-surface-raised">
                Reset
              </button>
              <button type="submit" disabled={loading}
                className="rounded bg-accent-primary px-4 py-1.5 text-xs font-semibold text-bg-base transition-opacity disabled:opacity-50">
                {loading ? 'Searching…' : 'Search'}
              </button>
            </div>
          </div>
        </form>

        {error && (
          <div className="mb-4 rounded border border-severity-critical/30 bg-severity-critical/5 px-4 py-3 text-sm text-severity-critical">{error}</div>
        )}

        {loading && !result ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
          </div>
        ) : result && result.hits.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-card border border-border-default bg-bg-surface py-20">
            <div className="mb-4 text-4xl opacity-30">☰</div>
            <h3 className="text-sm font-semibold text-text-primary">No logs match these filters</h3>
            <p className="mt-1 text-xs text-text-secondary">Try adjusting your search criteria or expanding the time range.</p>
          </div>
        ) : result ? (
          <>
            <div className="mb-3 flex items-center justify-between text-xs text-text-secondary">
              <span>
                Showing {(result.page - 1) * result.pageSize + 1}–
                {Math.min(result.page * result.pageSize, result.total)} of{' '}
                <span className="font-mono text-text-primary">{result.total.toLocaleString()}</span> results
              </span>
              {loading && <span className="flex items-center gap-1.5"><div className="h-3 w-3 animate-spin rounded-full border border-accent-primary border-t-transparent" />Updating…</span>}
            </div>

            <div className="overflow-x-auto rounded-card border border-border-default">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border-default bg-bg-surface text-text-secondary">
                    <th className="px-4 py-3 font-medium">Timestamp</th>
                    <th className="px-4 py-3 font-medium">Source IP</th>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Outcome</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Raw Message</th>
                  </tr>
                </thead>
                <tbody>
                  {result.hits.map((hit) => (
                    <tr key={hit._id} onClick={() => setSelectedLog(hit)}
                      className={`group cursor-pointer border-b border-border-default transition-colors hover:bg-bg-surface-raised ${
                        selectedLog?._id === hit._id ? 'bg-accent-primary/5' : 'bg-bg-surface'
                      } ${
                        hit._source.outcome === 'failure' ? 'severity-rail border-l-severity-critical'
                        : hit._source.outcome === 'success' ? 'severity-rail border-l-severity-resolved' : ''
                      }`}
                      style={{ minHeight: '44px' }}>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-text-secondary">{formatTimestamp(hit)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-text-primary">{(hit._source.source_ip as string) ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-text-primary">{(hit._source.ssh_user as string) ?? '—'}</td>
                      <td className={`whitespace-nowrap px-4 py-2.5 font-mono font-semibold ${outcomeColor(hit._source.outcome as string)}`}>{(hit._source.outcome as string) ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">{(hit._source.log_source as string) ?? '—'}</td>
                      <td className="max-w-xs truncate px-4 py-2.5 font-mono text-text-secondary group-hover:text-text-primary">{(hit._source.raw_message as string) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={result.page} totalPages={result.totalPages} onPageChange={(p) => doSearch(p)} />
          </>
        ) : null}
      </div>

      {/* SIEM detail panel */}
      {selectedLog && (
        <div ref={detailRef} className="ml-4 w-96 flex-shrink-0 animate-in rounded-card border border-border-default bg-bg-surface"
          style={{ animation: 'slideIn 0.2s ease-out' }}>
          <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
            <h2 className="text-sm font-semibold text-text-primary">Log Detail</h2>
            <button onClick={() => setSelectedLog(null)}
              className="rounded p-1 text-text-secondary transition-colors hover:bg-bg-surface-raised hover:text-text-primary">✕</button>
          </div>
          <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-4">
            <div className="space-y-2">
              <DetailField label="ID" value={selectedLog._id} />
              <DetailField label="Index" value={selectedLog._index} />
              <DetailField label="Timestamp" value={formatTimestamp(selectedLog)} />
              <DetailField label="Source IP" value={selectedLog._source.source_ip as string} />
              <DetailField label="SSH User" value={selectedLog._source.ssh_user as string} />
              <DetailField label="Outcome" value={selectedLog._source.outcome as string}
                valueClass={outcomeColor(selectedLog._source.outcome as string)} />
              <DetailField label="Log Source" value={selectedLog._source.log_source as string} />
              <DetailField label="Event Type" value={selectedLog._source.event_type as string} />
              <DetailField label="Host" value={selectedLog._source.host as string} />
            </div>
            <div className="mt-4">
              <h3 className="mb-1.5 text-xs font-medium text-text-secondary">Raw Message</h3>
              <pre className="overflow-x-auto rounded border border-border-default bg-bg-base p-3 font-mono text-xs leading-relaxed text-text-primary">
                {(selectedLog._source.raw_message as string) ?? '(empty)'}
              </pre>
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-medium text-text-secondary hover:text-text-primary">Full document source</summary>
              <pre className="mt-2 overflow-x-auto rounded border border-border-default bg-bg-base p-3 font-mono text-[11px] leading-relaxed text-text-secondary">
                {JSON.stringify(selectedLog._source, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// ROOT COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function LogExplorer() {
  const { selectedSourceId, selectedSource } = useSource();
  const isAllSources = selectedSourceId === ALL_SOURCES_ID;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Log Explorer</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {isAllSources
              ? 'Search all ingested log events across connected sources via the SIEM engine.'
              : (
                <>
                  Raw logs from{' '}
                  <span className="font-mono font-semibold text-accent-primary">{selectedSource?.app_name}</span>
                  {' '}— direct event stream from your connected website/app.
                </>
              )}
          </p>
        </div>
        <SourceSelector />
      </div>

      {/* Mode switch visual indicator */}
      {!isAllSources && selectedSource && (
        <div className="flex items-center gap-3 rounded-xl border border-accent-primary/25 bg-bg-surface px-5 py-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-primary/10 border border-accent-primary/25 text-lg flex-shrink-0">
            📦
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary">
              Viewing: <span className="text-accent-primary">{selectedSource.app_name}</span> — Raw Website Logs
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              These are the actual events sent by your connected website or app via the Grid Sentry SDK.
              Each row is a real log event (login, error, API call, etc.) as it happened.
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`h-2 w-2 rounded-full ${selectedSource.is_active ? 'bg-severity-resolved animate-pulse' : 'bg-text-disabled'}`} />
            <span className="font-mono text-[11px] text-text-secondary">{selectedSource.is_active ? 'Live' : 'Inactive'}</span>
          </div>
        </div>
      )}

      {/* Render the correct mode */}
      {isAllSources ? <SiemLogSearch /> : <SourceLogView />}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function DetailField({
  label, value, valueClass = 'text-text-primary',
}: {
  label: string; value?: string | null; valueClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="flex-shrink-0 text-xs text-text-secondary">{label}</span>
      <span className={`truncate text-right font-mono text-xs ${valueClass}`}>{value ?? '—'}</span>
    </div>
  );
}
