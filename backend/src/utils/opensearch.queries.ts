import { opensearch } from '../config/opensearch.js';
import { logger } from '../config/logger.js';

/** Index pattern for all SOC log indices (monthly rollover: soc-logs-YYYY-MM). */
export const SOC_LOGS_PATTERN = 'soc-logs-*';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface IngestStats {
  totalDocs: number;
  latestTimestamp: string | null;
  outcomeBreakdown: Record<string, number>;
  logSourceBreakdown: Record<string, number>;
}

export interface LogSearchParams {
  q?: string;
  from?: string;       // ISO timestamp
  to?: string;         // ISO timestamp
  logSource?: string;
  sourceIp?: string;
  outcome?: string;
  orgId?: string;
  page: number;        // 1-based
  pageSize: number;    // max 500
}

export interface LogHit {
  _id: string;
  _index: string;
  _source: Record<string, unknown>;
}

export interface LogSearchResult {
  hits: LogHit[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Return the total document count across all `soc-logs-*` indices.
 * Scoped to orgId if provided. Returns 0 when no indices or docs exist.
 */
export async function getLogCount(orgId?: string): Promise<number> {
  try {
    const body: Record<string, any> = {};
    if (orgId) {
      body.query = {
        bool: {
          should: [
            { term: { org_id: orgId } },
            { term: { 'org_id.keyword': orgId } },
          ],
          minimum_should_match: 1,
        },
      };
    }
    const { body: countBody } = await opensearch.count({ index: SOC_LOGS_PATTERN, ...(orgId ? { body } : {}) });
    return (countBody as { count: number }).count;
  } catch (err: unknown) {
    if (isOpenSearchNotFound(err)) return 0;
    logger.error('getLogCount failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

/**
 * Aggregate ingestion statistics: total docs, latest timestamp, and breakdowns
 * by `outcome` and `log_source`. Used by the `/api/logs/ingest-stats` endpoint.
 */
export async function getIngestStats(orgId?: string): Promise<IngestStats> {
  try {
    const query: Record<string, any> = orgId
      ? {
          bool: {
            should: [
              { term: { org_id: orgId } },
              { term: { 'org_id.keyword': orgId } },
            ],
            minimum_should_match: 1,
          },
        }
      : { match_all: {} };

    const { body } = await opensearch.search({
      index: SOC_LOGS_PATTERN,
      body: {
        size: 0,
        query,
        aggs: {
          latest: { max: { field: '@timestamp' } },
          by_outcome: { terms: { field: 'outcome', size: 10 } },
          by_log_source: { terms: { field: 'log_source', size: 20 } },
        },
      },
    });

    const aggs = (body as any).aggregations ?? {};
    const hits = (body as any).hits?.total;
    const totalDocs = typeof hits === 'number' ? hits : hits?.value ?? 0;

    return {
      totalDocs,
      latestTimestamp: aggs.latest?.value_as_string ?? null,
      outcomeBreakdown: bucketsToRecord(aggs.by_outcome?.buckets),
      logSourceBreakdown: bucketsToRecord(aggs.by_log_source?.buckets),
    };
  } catch (err: unknown) {
    if (isOpenSearchNotFound(err)) {
      return {
        totalDocs: 0,
        latestTimestamp: null,
        outcomeBreakdown: {},
        logSourceBreakdown: {},
      };
    }
    logger.error('getIngestStats failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      totalDocs: 0,
      latestTimestamp: null,
      outcomeBreakdown: {},
      logSourceBreakdown: {},
    };
  }
}

/**
 * Search logs in OpenSearch with keyword, time range, and field filters.
 * Builds a bool query dynamically based on which params are present.
 * Results are sorted by @timestamp descending (newest first).
 */
export async function searchLogs(params: LogSearchParams): Promise<LogSearchResult> {
  const { q, from, to, logSource, sourceIp, outcome, orgId, page, pageSize } = params;

  const must: object[] = [];
  const filter: object[] = [];

  // Scoped to calling organization if present
  if (orgId) {
    filter.push({
      bool: {
        should: [
          { term: { org_id: orgId } },
          { term: { 'org_id.keyword': orgId } },
        ],
        minimum_should_match: 1,
      },
    });
  }

  // Full-text keyword search on raw_message
  if (q) {
    must.push({
      match: { raw_message: { query: q, operator: 'and' } },
    });
  }

  // Time range filter
  const range: Record<string, string> = {};
  if (from) range.gte = from;
  if (to) range.lte = to;
  if (Object.keys(range).length > 0) {
    filter.push({ range: { '@timestamp': range } });
  }

  // Keyword field filters
  if (logSource) {
    filter.push({
      bool: {
        should: [
          { term: { log_source: logSource } },
          { term: { project_name: logSource } },
          { match: { log_source: logSource } },
          { match: { project_name: logSource } },
        ],
        minimum_should_match: 1,
      },
    });
  }
  if (sourceIp) filter.push({ term: { source_ip: sourceIp } });
  if (outcome) filter.push({ term: { outcome } });

  const body: Record<string, unknown> = {
    query: {
      bool: {
        ...(must.length > 0 ? { must } : { must: [{ match_all: {} }] }),
        ...(filter.length > 0 ? { filter } : {}),
      },
    },
    sort: [{ '@timestamp': { order: 'desc' } }],
    from: (page - 1) * pageSize,
    size: pageSize,
  };

  try {
    const { body: responseBody } = await opensearch.search({
      index: SOC_LOGS_PATTERN,
      body,
    });

    const resp = responseBody as any;
    const hitsObj = resp.hits ?? {};
    const totalRaw = hitsObj.total;
    const total: number = typeof totalRaw === 'number' ? totalRaw : totalRaw?.value ?? 0;

    const hits: LogHit[] = (hitsObj.hits ?? []).map((h: any) => ({
      _id: h._id as string,
      _index: h._index as string,
      _source: h._source as Record<string, unknown>,
    }));

    return {
      hits,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (err: unknown) {
    if (isOpenSearchNotFound(err)) {
      return { hits: [], total: 0, page, pageSize, totalPages: 0 };
    }
    logger.error('searchLogs failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Fetch a single log document by its OpenSearch _id.
 * Searches across all soc-logs-* indices since we don't know which daily index it's in.
 */
export async function getLogById(id: string): Promise<LogHit | null> {
  try {
    // Use search with _id filter — more reliable across index aliases than a direct GET
    const { body } = await opensearch.search({
      index: SOC_LOGS_PATTERN,
      body: {
        query: { ids: { values: [id] } },
        size: 1,
      },
    });

    const hits = (body as any).hits?.hits ?? [];
    if (hits.length === 0) return null;

    const h = hits[0];
    return {
      _id: h._id as string,
      _index: h._index as string,
      _source: h._source as Record<string, unknown>,
    };
  } catch (err: unknown) {
    if (isOpenSearchNotFound(err)) return null;
    logger.error('getLogById failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert OpenSearch terms-aggregation buckets to a simple key→count map. */
function bucketsToRecord(
  buckets?: Array<{ key: string; doc_count: number }>,
): Record<string, number> {
  const result: Record<string, number> = {};
  if (!Array.isArray(buckets)) return result;
  for (const b of buckets) {
    result[b.key] = b.doc_count;
  }
  return result;
}

/** Check whether an OpenSearch error is a 404 (index_not_found). */
export function isOpenSearchNotFound(err: unknown): boolean {
  if (typeof err === 'object' && err !== null && 'meta' in err) {
    const meta = (err as any).meta;
    if (meta?.statusCode === 404) return true;
  }
  return false;
}

export interface ExternalLogPayload {
  timestamp?: string;
  event_type: string;
  source_ip?: string;
  user_identifier?: string;
  raw_message?: string;
  log_source?: string;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Bulk index external log events sent by the Grid Sentry Client SDK (TICKET-015).
 */
export async function ingestExternalLogs(
  events: ExternalLogPayload[],
  defaultLogSource?: string,
  orgId?: string,
  projectName?: string,
): Promise<number> {
  if (!Array.isArray(events) || events.length === 0) return 0;

  const indexName = `soc-logs-${new Date().toISOString().slice(0, 7)}`;
  const bulkBody: Array<Record<string, any>> = [];

  for (const ev of events) {
    const ts = ev.timestamp || new Date().toISOString();
    const doc = {
      '@timestamp': ts,
      timestamp: ts,
      org_id: orgId || null,
      project_name: projectName || defaultLogSource || null,
      log_source: ev.log_source || defaultLogSource || 'external_client_sdk',
      event_type: ev.event_type,
      source_ip: ev.source_ip || '127.0.0.1',
      ssh_user: ev.user_identifier || null,
      user_identifier: ev.user_identifier || null,
      outcome: ev.event_type.toLowerCase().includes('fail') || ev.event_type.toLowerCase().includes('error') ? 'failure' : 'success',
      raw_message: ev.raw_message || `[SDK] ${ev.event_type} event logged`,
      details: ev.details || {},
    };
    bulkBody.push({ index: { _index: indexName } });
    bulkBody.push(doc);
  }

  try {
    const res = await opensearch.bulk<any>({ refresh: true, body: bulkBody });
    if (res.body?.errors) {
      logger.warn('Some external SDK logs failed to index in OpenSearch', { items: res.body.items });
    }
    return events.length;
  } catch (err) {
    logger.error('ingestExternalLogs failed', { error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

