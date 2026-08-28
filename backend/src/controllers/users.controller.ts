import type { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import * as UsersModel from '../models/users.model.js';
import { hashPassword } from '../utils/password.js';
import { ROLE_PERMISSIONS, type Role } from '../auth/permissions.js';

const CreateUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['viewer', 'analyst', 'admin'] as [Role, ...Role[]]),
});

const SuspendUserSchema = z.object({
  reason: z.string().min(1, 'Suspension reason is required').max(500),
  confirm_self: z.boolean().optional().default(false),
});

const UpdateRoleSchema = z.object({
  role: z.enum(['viewer', 'analyst', 'admin'] as [Role, ...Role[]]),
});

export async function listUsers(_req: Request, res: Response): Promise<void> {
  const users = await UsersModel.getAllUsers();
  res.status(200).json({ status: 'ok', data: users });
}

import { logAuditEvent } from '../utils/auditLogger.js';

export async function createUser(req: Request, res: Response): Promise<void> {
  const parsed = CreateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw ApiError.badRequest(`Invalid user input: ${issues}`);
  }

  const existing = await UsersModel.findByEmail(parsed.data.email);
  if (existing) {
    throw ApiError.conflict('A user with that email already exists');
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const newUser = await UsersModel.createUser({
    email: parsed.data.email,
    passwordHash,
    role: parsed.data.role,
  });

  logAuditEvent({
    userId: req.user?.id ?? null,
    action: 'user.created',
    targetType: 'user',
    targetId: newUser.id,
    details: { email: newUser.email, role: newUser.role },
  });

  const { password_hash, ...safeUser } = newUser;
  res.status(201).json({ status: 'ok', data: safeUser });
}

export async function suspendUser(req: Request, res: Response): Promise<void> {
  const targetId = parseInt(req.params.id ?? '', 10);
  if (isNaN(targetId)) throw ApiError.badRequest('Invalid user ID');

  const parsed = SuspendUserSchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw ApiError.badRequest(`Invalid suspension parameters: ${issues}`);
  }

  const targetUser = await UsersModel.findById(targetId);
  if (!targetUser) throw ApiError.notFound('User not found');

  if (!targetUser.is_active) {
    throw ApiError.badRequest('User is already suspended');
  }

  // Guard: Check last remaining active admin
  if (targetUser.role === 'admin') {
    const activeAdmins = await UsersModel.getActiveAdminCount();
    if (activeAdmins <= 1) {
      throw ApiError.badRequest('Cannot suspend the last remaining active Admin account');
    }
  }

  // Guard: Self-suspension confirmation check
  const currentUserId = req.user?.id;
  if (currentUserId === targetId && !parsed.data.confirm_self) {
    throw ApiError.badRequest('Suspending your own Admin account requires explicit confirmation');
  }

  const suspended = await UsersModel.suspendUser(targetId, parsed.data.reason);

  logAuditEvent({
    userId: currentUserId ?? null,
    action: 'user.suspended',
    targetType: 'user',
    targetId,
    details: { reason: parsed.data.reason, email: targetUser.email },
  });

  res.status(200).json({ status: 'ok', data: suspended });
}

export async function reactivateUser(req: Request, res: Response): Promise<void> {
  const targetId = parseInt(req.params.id ?? '', 10);
  if (isNaN(targetId)) throw ApiError.badRequest('Invalid user ID');

  const targetUser = await UsersModel.findById(targetId);
  if (!targetUser) throw ApiError.notFound('User not found');

  if (targetUser.is_active) {
    throw ApiError.badRequest('User is already active');
  }

  const reactivated = await UsersModel.reactivateUser(targetId);

  logAuditEvent({
    userId: req.user?.id ?? null,
    action: 'user.reactivated',
    targetType: 'user',
    targetId,
    details: { email: targetUser.email },
  });

  res.status(200).json({ status: 'ok', data: reactivated });
}

export async function updateRole(req: Request, res: Response): Promise<void> {
  const targetId = parseInt(req.params.id ?? '', 10);
  if (isNaN(targetId)) throw ApiError.badRequest('Invalid user ID');

  const parsed = UpdateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw ApiError.badRequest(`Invalid role input: ${issues}`);
  }

  const targetUser = await UsersModel.findById(targetId);
  if (!targetUser) throw ApiError.notFound('User not found');

  // Guard: Downgrading last active admin
  if (targetUser.role === 'admin' && parsed.data.role !== 'admin' && targetUser.is_active) {
    const activeAdmins = await UsersModel.getActiveAdminCount();
    if (activeAdmins <= 1) {
      throw ApiError.badRequest('Cannot downgrade the last remaining active Admin account');
    }
  }

  const updated = await UsersModel.updateUserRole(targetId, parsed.data.role);

  logAuditEvent({
    userId: req.user?.id ?? null,
    action: 'user.role_updated',
    targetType: 'user',
    targetId,
    details: { previousRole: targetUser.role, newRole: parsed.data.role, email: targetUser.email },
  });

  res.status(200).json({ status: 'ok', data: updated });
}
