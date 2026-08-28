import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as AuditController from '../controllers/audit.controller.js';

const router = Router();

// All routes require authentication and Admin role (audit:read permission)
router.use(authenticate);

router.get('/', requirePermission('audit:read'), asyncHandler(AuditController.listAuditLogs));

export default router;
