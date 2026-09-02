import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import { requireOrgScope } from '../middleware/orgScope.js';
import { requirePermission } from '../middleware/rbac.js';
import * as InviteController from '../controllers/invite.controller.js';

const router = Router();

// All org-management routes require: authentication + orgId + admin permission
router.post(
  '/invite',
  authenticate,
  requireOrgScope(),
  requirePermission('users:write'),
  asyncHandler(InviteController.sendInvite),
);

router.get(
  '/invitations',
  authenticate,
  requireOrgScope(),
  requirePermission('users:read'),
  asyncHandler(InviteController.listInvitations),
);

router.delete(
  '/invitations/:id',
  authenticate,
  requireOrgScope(),
  requirePermission('users:write'),
  asyncHandler(InviteController.revokeInvitation),
);

export default router;
