import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as AlertsController from '../controllers/alerts.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Read endpoints (Viewer, Analyst, Admin)
router.get('/', requirePermission('alerts:read'), asyncHandler(AlertsController.listAlerts));
router.get('/export', requirePermission('alerts:read'), asyncHandler(AlertsController.exportAlerts));
router.get('/ip-intel/:ip', requirePermission('alerts:read'), asyncHandler(AlertsController.getIpIntel));
router.get('/:id', requirePermission('alerts:read'), asyncHandler(AlertsController.getAlert));
router.get('/:id/notes', requirePermission('alerts:read'), asyncHandler(AlertsController.listNotes));
router.get('/:id/raw-logs', requirePermission('alerts:read'), asyncHandler(AlertsController.getRawLogs));

// Write endpoints (Analyst, Admin)
router.patch('/:id/status', requirePermission('alerts:write'), asyncHandler(AlertsController.updateStatus));
router.post('/:id/notes', requirePermission('alerts:write'), asyncHandler(AlertsController.createNote));

export default router;
