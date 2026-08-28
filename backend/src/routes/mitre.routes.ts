import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as MitreController from '../controllers/mitre.controller.js';

const router = Router();

// All routes require authentication and alerts:read permission (Viewer+)
router.use(authenticate);

router.get('/matrix', requirePermission('alerts:read'), asyncHandler(MitreController.getMatrix));

export default router;
