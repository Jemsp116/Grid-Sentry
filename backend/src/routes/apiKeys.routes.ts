import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { requireOrgScope } from '../middleware/orgScope.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as ApiKeysController from '../controllers/apiKeys.controller.js';

const router = Router();

router.use(authenticate, requireOrgScope());

router.post('/', requirePermission('apikeys:write'), asyncHandler(ApiKeysController.createApiKey));
router.get('/', requirePermission('apikeys:read'), asyncHandler(ApiKeysController.listApiKeys));
router.get('/:id/status', requirePermission('apikeys:read'), asyncHandler(ApiKeysController.getApiKeyStatus));
router.patch('/:id/revoke', requirePermission('apikeys:write'), asyncHandler(ApiKeysController.revokeApiKey));

export default router;
