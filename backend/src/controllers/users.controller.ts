import type { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import * as UsersModel from '../models/users.model.js';
import { logAuditEvent } from '../utils/auditLogger.js';
import { ROLES, type Role } from '../auth/permissions.js';

const SuspendUserSchema = z.object({
  reason: z.string().min(1, 'Suspension reason is required').max(500),
  confirm_self: z.boolean().optional().default(false),
});

const UpdateRoleSchema = z.object({
  role: z.enum(ROLES as unknown as [Role, ...Role[]]),
});

export async function listUsers(req: Request, res: Response): Promise<void> {
  if (!req.user) throw ApiError.unauthorized();
  // List only users within the caller's org
  const users = await UsersModel.getAllUsers(req.user.orgId);
  res.status(200).json({ status: 'ok', data: users });
}

export async function suspendUser(req: Request, res: Response): Promise<void> {
  if (!req.user) throw ApiError.unauthorized();
  const orgId = req.user.orgId;

  const targetId = parseInt(req.params.id ?? '', 10);
  if (isNaN(targetId)) throw ApiError.badRequest('Invalid user ID');

  const parsed = SuspendUserSchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw ApiError.badRequest(`Invalid suspension parameters: ${issues}`);
  }

  // Fetch target within the same org — this prevents cross-org suspension
  const targetUser = await UsersModel.findByIdInOrg(targetId, orgId);
  if (!targetUser) throw ApiError.notFound('User not found');

  if (!targetUser.is_active) {
    throw ApiError.badRequest('User is already suspended');
  }

  // Guard: Check last remaining active admin within this org
  if (targetUser.role === 'admin') {
    const activeAdmins = await UsersModel.getActiveAdminCount(orgId);
    if (activeAdmins <= 1) {
      throw ApiError.badRequest('Cannot suspend the last remaining active Admin account');
    }
  }

  // Guard: Self-suspension confirmation check
  const currentUserId = req.user.id;
  if (currentUserId === targetId && !parsed.data.confirm_self) {
    throw ApiError.badRequest('Suspending your own Admin account requires explicit confirmation');
  }

  const suspended = await UsersModel.suspendUser(targetId, orgId, parsed.data.reason);

  logAuditEvent({
    userId: currentUserId,
    orgId,
    action: 'user.suspended',
    targetType: 'user',
    targetId,
    details: { reason: parsed.data.reason, email: targetUser.email },
  });

  res.status(200).json({ status: 'ok', data: suspended });
}

export async function reactivateUser(req: Request, res: Response): Promise<void> {
  if (!req.user) throw ApiError.unauthorized();
  const orgId = req.user.orgId;

  const targetId = parseInt(req.params.id ?? '', 10);
  if (isNaN(targetId)) throw ApiError.badRequest('Invalid user ID');

  const targetUser = await UsersModel.findByIdInOrg(targetId, orgId);
  if (!targetUser) throw ApiError.notFound('User not found');

  if (targetUser.is_active) {
    throw ApiError.badRequest('User is already active');
  }

  const reactivated = await UsersModel.reactivateUser(targetId, orgId);

  logAuditEvent({
    userId: req.user.id,
    orgId,
    action: 'user.reactivated',
    targetType: 'user',
    targetId,
    details: { email: targetUser.email },
  });

  res.status(200).json({ status: 'ok', data: reactivated });
}

export async function updateRole(req: Request, res: Response): Promise<void> {
  if (!req.user) throw ApiError.unauthorized();
  const orgId = req.user.orgId;

  const targetId = parseInt(req.params.id ?? '', 10);
  if (isNaN(targetId)) throw ApiError.badRequest('Invalid user ID');

  const parsed = UpdateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw ApiError.badRequest(`Invalid role input: ${issues}`);
  }

  const targetUser = await UsersModel.findByIdInOrg(targetId, orgId);
  if (!targetUser) throw ApiError.notFound('User not found');

  // Guard: Downgrading last active admin within this org
  if (targetUser.role === 'admin' && parsed.data.role !== 'admin' && targetUser.is_active) {
    const activeAdmins = await UsersModel.getActiveAdminCount(orgId);
    if (activeAdmins <= 1) {
      throw ApiError.badRequest('Cannot downgrade the last remaining active Admin account');
    }
  }

  const updated = await UsersModel.updateUserRole(targetId, orgId, parsed.data.role);

  logAuditEvent({
    userId: req.user.id,
    orgId,
    action: 'user.role_updated',
    targetType: 'user',
    targetId,
    details: { previousRole: targetUser.role, newRole: parsed.data.role, email: targetUser.email },
  });

  res.status(200).json({ status: 'ok', data: updated });
}
