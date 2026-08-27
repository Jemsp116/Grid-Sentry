import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { pingDb } from '../config/db.js';
import { pingOpenSearch } from '../config/opensearch.js';

const router = Router();

/**
 * GET /api/health — liveness + dependency status.
 * Returns 200 when the API process is up. `dependencies` reports Postgres and
 * OpenSearch reachability without failing the whole check (the frontend
 * placeholder page in TICKET-000 only needs a 200 here).
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [db, opensearch] = await Promise.all([pingDb(), pingOpenSearch()]);
    res.status(200).json({
      status: 'ok',
      dependencies: { postgres: db, opensearch },
      time: new Date().toISOString(),
    });
  }),
);

export default router;
