import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as RulesController from '../controllers/rules.controller.js';

const router = Router();

// All routes require user authentication
router.use(authenticate);

// Read endpoints
router.get('/', requirePermission('rules:read'), asyncHandler(RulesController.listRules));
router.get('/:id', requirePermission('rules:read'), asyncHandler(RulesController.getRule));
router.post('/dry-run', requirePermission('rules:read'), asyncHandler(RulesController.dryRunRule));

// Write endpoints (Admin only)
router.post('/', requirePermission('rules:write'), asyncHandler(RulesController.createRule));
router.put('/:id', requirePermission('rules:write'), asyncHandler(RulesController.updateRule));
router.patch('/:id/toggle', requirePermission('rules:write'), asyncHandler(RulesController.toggleRule));
router.delete('/:id', requirePermission('rules:write'), asyncHandler(RulesController.deleteRule));

export default router;
