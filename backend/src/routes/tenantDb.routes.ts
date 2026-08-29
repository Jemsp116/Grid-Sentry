import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as TenantDbController from '../controllers/tenantDb.controller.js';

const router = Router();

router.use(authenticate);

router.post('/connect', asyncHandler(TenantDbController.connectTenantDb));
router.get('/status', asyncHandler(TenantDbController.getTenantDbStatus));
router.delete('/disconnect', asyncHandler(TenantDbController.disconnectTenantDb));

export default router;
