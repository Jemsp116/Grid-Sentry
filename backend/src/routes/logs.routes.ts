import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getIngestStats, searchLogs, getLogById, ingestExternalLogs } from '../utils/opensearch.queries.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Log-related API routes.
 *
 * TICKET-003: `GET /ingest-stats` — verify logs are flowing into OpenSearch.
 * TICKET-004: `GET /search` — filtered, paginated log search.
 * TICKET-004: `GET /:id` — single log document by OpenSearch _id.
 * TICKET-015: `POST /ingest` — external log ingestion API for Grid Sentry Client SDK.
 */
const router = Router();

// ─── External Ingestion (API Key Protected) ───────────────────────────────────

/**
 * POST /api/logs/ingest
 *
 * Ingest external logs sent by the grid-sentry-client SDK or third-party webhooks.
 * Authenticated via X-API-Key header.
 */
router.post(
  '/ingest',
  asyncHandler(async (req, res) => {
    const apiKey = req.headers['x-api-key'] || req.headers['x-api-token'];
    if (!apiKey || apiKey !== env.INGEST_API_KEY) {
      throw ApiError.unauthorized('Invalid or missing X-API-Key header');
    }

    const payload = Array.isArray(req.body) ? req.body : [req.body];
    const validEvents: any[] = [];

    for (const item of payload) {
      if (!item || typeof item !== 'object') continue;
      if (!item.event_type || typeof item.event_type !== 'string' || !item.event_type.trim()) {
        throw ApiError.badRequest('Each log event must specify a non-empty string event_type');
      }
      validEvents.push({
        timestamp: item.timestamp,
        event_type: item.event_type.trim(),
        source_ip: item.source_ip,
        user_identifier: item.user_identifier || item.user,
        raw_message: item.raw_message,
        details: item.details || {},
      });
    }

    if (validEvents.length === 0) {
      throw ApiError.badRequest('No valid log events provided in request body');
    }

    const count = await ingestExternalLogs(validEvents);
    res.status(200).json({ status: 'ok', ingested: count });
  }),
);

// ─── Validation schemas ─────────────────────────────────────────────────────

const SearchQuerySchema = z.object({
  q: z.string().optional(),
  from: z.string().datetime({ offset: true }).optional()
    .or(z.string().datetime().optional()),
  to: z.string().datetime({ offset: true }).optional()
    .or(z.string().datetime().optional()),
  logSource: z.string().optional(),
  sourceIp: z.string().optional(),
  outcome: z.enum(['success', 'failure']).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
});

// ─── Routes ─────────────────────────────────────────────────────────────────

/**
 * GET /api/logs/ingest-stats
 *
 * Returns aggregated ingestion statistics: total doc count, latest timestamp,
 * and breakdowns by outcome (success/failure) and log source (ssh_auth, etc.).
 */
router.get(
  '/ingest-stats',
  authenticate,
  requirePermission('logs:read'),
  asyncHandler(async (_req, res) => {
    const stats = await getIngestStats();
    res.status(200).json({
      status: 'ok',
      data: stats,
    });
  }),
);

/**
 * GET /api/logs/search
 *
 * Search logs in OpenSearch with filters. All params are optional — an empty
 * search returns the most recent logs. Results are sorted newest-first.
 *
 * Query params:
 *   q         — keyword (full-text on raw_message)
 *   from / to — ISO timestamps for time range
 *   logSource — filter by log_source field
 *   sourceIp  — filter by source_ip field
 *   outcome   — filter by outcome (success | failure)
 *   page      — 1-based page number (default 1)
 *   pageSize  — results per page, 1–500 (default 50)
 */
router.get(
  '/search',
  authenticate,
  requirePermission('logs:read'),
  asyncHandler(async (req, res) => {
    const parsed = SearchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      throw ApiError.badRequest(`Invalid query parameters: ${issues}`);
    }

    const result = await searchLogs(parsed.data);
    res.status(200).json({ status: 'ok', data: result });
  }),
);

/**
 * GET /api/logs/:id
 *
 * Fetch a single log document by its OpenSearch _id. Used by the detail panel
 * in the Log Explorer, and later by the alert detail view (TICKET-006) to
 * show the raw logs that triggered an alert.
 */
router.get(
  '/:id',
  authenticate,
  requirePermission('logs:read'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) throw ApiError.badRequest('Log ID is required');

    const doc = await getLogById(id);
    if (!doc) throw ApiError.notFound('Log entry not found');

    res.status(200).json({ status: 'ok', data: doc });
  }),
);

export default router;
