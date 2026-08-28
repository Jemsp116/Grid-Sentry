import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as BlocklistController from '../controllers/blocklist.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Read endpoints
router.get('/', requirePermission('blocklist:read'), asyncHandler(BlocklistController.listBlocklist));

// Write endpoints (Analyst & Admin)
router.post('/', requirePermission('blocklist:write'), asyncHandler(BlocklistController.addBlock));
router.delete('/:id', requirePermission('blocklist:write'), asyncHandler(BlocklistController.removeBlock));

export default router;
