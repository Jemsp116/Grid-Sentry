import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as DashboardController from '../controllers/dashboard.controller.js';

const router = Router();

// All routes require authentication and dashboard:read permission (Viewer+)
router.use(authenticate);

router.get('/summary', requirePermission('dashboard:read'), asyncHandler(DashboardController.getSummary));
router.get('/geo', requirePermission('dashboard:read'), asyncHandler(DashboardController.getGeo));

export default router;
