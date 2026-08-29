import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { pingDb } from '../config/db.js';
import { pingOpenSearch } from '../config/opensearch.js';
import { getLogCount } from '../utils/opensearch.queries.js';

const router = Router();

/**
 * GET /api/health — liveness + dependency status.
 * Returns 200 when the API process is up. `dependencies` reports MongoDB and
 * OpenSearch reachability without failing the whole check.
 * `ingestion` reports the current doc count in soc-logs-* (TICKET-003).
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [db, opensearch] = await Promise.all([pingDb(), pingOpenSearch()]);

    // Non-critical: if the count query fails, we still return 200.
    let docCount = 0;
    try {
      docCount = await getLogCount();
    } catch {
      // already logged inside getLogCount
    }

    res.status(200).json({
      status: 'ok',
      dependencies: { mongodb: db, opensearch },
      ingestion: { docCount },
      time: new Date().toISOString(),
    });
  }),
);

export default router;
