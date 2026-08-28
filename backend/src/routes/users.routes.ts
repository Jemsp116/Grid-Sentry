import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as UsersController from '../controllers/users.controller.js';

const router = Router();

// All routes require authentication and Admin role (users:write permission)
router.use(authenticate);

router.get('/', requirePermission('users:write'), asyncHandler(UsersController.listUsers));
router.post('/', requirePermission('users:write'), asyncHandler(UsersController.createUser));
router.patch('/:id/suspend', requirePermission('users:write'), asyncHandler(UsersController.suspendUser));
router.patch('/:id/reactivate', requirePermission('users:write'), asyncHandler(UsersController.reactivateUser));
router.patch('/:id/role', requirePermission('users:write'), asyncHandler(UsersController.updateRole));

export default router;
