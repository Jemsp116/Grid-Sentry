import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { searchLogs, type LogEntry, type LogSearchParams, type LogSearchResponse } from '../api/logs.js';
import Pagination from '../components/Pagination.js';

// ─── Time-range presets ─────────────────────────────────────────────────────

const TIME_PRESETS = [
  { label: 'Last 1h', ms: 60 * 60 * 1000 },
  { label: 'Last 6h', ms: 6 * 60 * 60 * 1000 },
  { label: 'Last 24h', ms: 24 * 60 * 60 * 1000 },
  { label: 'Last 7d', ms: 7 * 24 * 60 * 60 * 1000 },
  { label: 'All time', ms: 0 },
] as const;

const PAGE_SIZE = 50;

export default function LogExplorer() {
  const { authFetch } = useAuth();

  // ── Filter state ────────────────────────────────────────────────────────
  const [keyword, setKeyword] = useState('');
  const [sourceIp, setSourceIp] = useState('');
  const [outcome, setOutcome] = useState<'' | 'success' | 'failure'>('');
  const [logSource, setLogSource] = useState('');
  const [timePreset, setTimePreset] = useState(2); // default: Last 24h

  // ── Result state ────────────────────────────────────────────────────────
  const [result, setResult] = useState<LogSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Detail panel ────────────────────────────────────────────────────────
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  // ── Search function ─────────────────────────────────────────────────────
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

  // Initial search on mount
  useEffect(() => {
    doSearch(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close detail panel on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedLog(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSelectedLog(null);
    doSearch(1);
  }

  function handleReset() {
    setKeyword('');
    setSourceIp('');
    setOutcome('');
    setLogSource('');
    setTimePreset(2);
    setSelectedLog(null);
  }

  function formatTimestamp(entry: LogEntry): string {
    const ts = entry._source['@timestamp'] ?? entry._source.timestamp;
    if (!ts) return '—';
    try {
      return new Date(ts as string).toLocaleString('en-GB', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      });
    } catch {
      return String(ts);
    }
  }

  const outcomeColor = (o?: string) => {
    if (o === 'failure') return 'text-severity-critical';
    if (o === 'success') return 'text-severity-resolved';
    return 'text-text-secondary';
  };

  return (
    <div className="flex gap-0">
      {/* ── Main panel ──────────────────────────────────────────────────── */}
      <div className={`flex-1 transition-all ${selectedLog ? 'pr-0' : ''}`}>
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-text-primary">Log Explorer</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Search and filter ingested log events from OpenSearch.
          </p>
        </div>

        {/* ── Filter bar ──────────────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-card border border-border-default bg-bg-surface p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Keyword */}
            <div>
              <label htmlFor="log-keyword" className="mb-1 block text-xs text-text-secondary">
                Keyword
              </label>
              <input
                id="log-keyword"
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g. Failed password"
                className="w-full rounded border border-border-default bg-bg-base px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none"
              />
            </div>

            {/* Source IP */}
            <div>
              <label htmlFor="log-source-ip" className="mb-1 block text-xs text-text-secondary">
                Source IP
              </label>
              <input
                id="log-source-ip"
                type="text"
                value={sourceIp}
                onChange={(e) => setSourceIp(e.target.value)}
                placeholder="e.g. 192.168.1.100"
                className="w-full rounded border border-border-default bg-bg-base px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none"
              />
            </div>

            {/* Outcome */}
            <div>
              <label htmlFor="log-outcome" className="mb-1 block text-xs text-text-secondary">
                Outcome
              </label>
              <select
                id="log-outcome"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as '' | 'success' | 'failure')}
                className="w-full rounded border border-border-default bg-bg-base px-3 py-2 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
              >
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>
            </div>

            {/* Log Source */}
            <div>
              <label htmlFor="log-source" className="mb-1 block text-xs text-text-secondary">
                Log Source
              </label>
              <input
                id="log-source"
                type="text"
                value={logSource}
                onChange={(e) => setLogSource(e.target.value)}
                placeholder="e.g. ssh_auth"
                className="w-full rounded border border-border-default bg-bg-base px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-disabled focus:border-accent-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Time presets + actions */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {TIME_PRESETS.map((preset, i) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setTimePreset(i)}
                  className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                    timePreset === i
                      ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                      : 'border-border-default text-text-secondary hover:bg-bg-surface-raised'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="rounded border border-border-default px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-surface-raised"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded bg-accent-primary px-4 py-1.5 text-xs font-semibold text-bg-base transition-opacity disabled:opacity-50"
              >
                {loading ? 'Searching…' : 'Search'}
              </button>
            </div>
          </div>
        </form>

        {/* ── Error state ─────────────────────────────────────────────── */}
        {error && (
          <div className="mb-4 rounded border border-severity-critical/30 bg-severity-critical/5 px-4 py-3 text-sm text-severity-critical">
            {error}
          </div>
        )}

        {/* ── Results table ───────────────────────────────────────────── */}
        {loading && !result ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
          </div>
        ) : result && result.hits.length === 0 ? (
          <EmptyState />
        ) : result ? (
          <>
            {/* Result count */}
            <div className="mb-3 flex items-center justify-between text-xs text-text-secondary">
              <span>
                Showing {(result.page - 1) * result.pageSize + 1}–
                {Math.min(result.page * result.pageSize, result.total)} of{' '}
                <span className="font-mono text-text-primary">{result.total.toLocaleString()}</span>{' '}
                results
              </span>
              {loading && (
                <span className="flex items-center gap-1.5">
                  <div className="h-3 w-3 animate-spin rounded-full border border-accent-primary border-t-transparent" />
                  Updating…
                </span>
              )}
            </div>

            {/* Table */}
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
                    <tr
                      key={hit._id}
                      onClick={() => setSelectedLog(hit)}
                      className={`group cursor-pointer border-b border-border-default transition-colors hover:bg-bg-surface-raised ${
                        selectedLog?._id === hit._id ? 'bg-accent-primary/5' : 'bg-bg-surface'
                      } ${
                        hit._source.outcome === 'failure'
                          ? 'severity-rail border-l-severity-critical'
                          : hit._source.outcome === 'success'
                            ? 'severity-rail border-l-severity-resolved'
                            : ''
                      }`}
                      style={{ minHeight: '44px' }}
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-text-secondary">
                        {formatTimestamp(hit)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-text-primary">
                        {(hit._source.source_ip as string) ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-text-primary">
                        {(hit._source.ssh_user as string) ?? '—'}
                      </td>
                      <td className={`whitespace-nowrap px-4 py-2.5 font-mono font-semibold ${outcomeColor(hit._source.outcome as string)}`}>
                        {(hit._source.outcome as string) ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">
                        {(hit._source.log_source as string) ?? '—'}
                      </td>
                      <td className="max-w-xs truncate px-4 py-2.5 font-mono text-text-secondary group-hover:text-text-primary">
                        {(hit._source.raw_message as string) ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              onPageChange={(p) => doSearch(p)}
            />
          </>
        ) : null}
      </div>

      {/* ── Detail panel (slide-in) ─────────────────────────────────────── */}
      {selectedLog && (
        <div
          ref={detailRef}
          className="ml-4 w-96 flex-shrink-0 animate-in rounded-card border border-border-default bg-bg-surface"
          style={{ animation: 'slideIn 0.2s ease-out' }}
        >
          <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
            <h2 className="text-sm font-semibold text-text-primary">Log Detail</h2>
            <button
              onClick={() => setSelectedLog(null)}
              className="rounded p-1 text-text-secondary transition-colors hover:bg-bg-surface-raised hover:text-text-primary"
              aria-label="Close detail panel"
            >
              ✕
            </button>
          </div>

          <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-4">
            {/* Parsed fields */}
            <div className="space-y-2">
              <DetailField label="ID" value={selectedLog._id} />
              <DetailField label="Index" value={selectedLog._index} />
              <DetailField
                label="Timestamp"
                value={formatTimestamp(selectedLog)}
              />
              <DetailField
                label="Source IP"
                value={selectedLog._source.source_ip as string}
              />
              <DetailField
                label="SSH User"
                value={selectedLog._source.ssh_user as string}
              />
              <DetailField
                label="Outcome"
                value={selectedLog._source.outcome as string}
                valueClass={outcomeColor(selectedLog._source.outcome as string)}
              />
              <DetailField
                label="Log Source"
                value={selectedLog._source.log_source as string}
              />
              <DetailField
                label="Event Type"
                value={selectedLog._source.event_type as string}
              />
              <DetailField
                label="Host"
                value={selectedLog._source.host as string}
              />
            </div>

            {/* Raw message */}
            <div className="mt-4">
              <h3 className="mb-1.5 text-xs font-medium text-text-secondary">Raw Message</h3>
              <pre className="overflow-x-auto rounded border border-border-default bg-bg-base p-3 font-mono text-xs leading-relaxed text-text-primary">
                {(selectedLog._source.raw_message as string) ?? '(empty)'}
              </pre>
            </div>

            {/* Full source (collapsible) */}
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-medium text-text-secondary hover:text-text-primary">
                Full document source
              </summary>
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

// ─── Sub-components ─────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-border-default bg-bg-surface py-20">
      <div className="mb-4 text-4xl opacity-30">☰</div>
      <h3 className="text-sm font-semibold text-text-primary">No logs match these filters</h3>
      <p className="mt-1 text-xs text-text-secondary">
        Try adjusting your search criteria or expanding the time range.
      </p>
    </div>
  );
}

function DetailField({
  label,
  value,
  valueClass = 'text-text-primary',
}: {
  label: string;
  value?: string | null;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="flex-shrink-0 text-xs text-text-secondary">{label}</span>
      <span className={`truncate text-right font-mono text-xs ${valueClass}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}
