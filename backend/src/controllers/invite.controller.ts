import type { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { ROLES, type Role } from '../auth/permissions.js';
import * as Invitations from '../models/invitations.model.js';
import * as Orgs from '../models/organizations.model.js';
import { sendInviteEmail } from '../utils/mailer.js';
import { logAuditEvent } from '../utils/auditLogger.js';
import { env } from '../config/env.js';

const InviteSchema = z.object({
  email: z.string().email('A valid email is required'),
  role: z.enum(ROLES as unknown as [Role, ...Role[]]),
});

/**
 * POST /api/org/invite
 * Admin-only. Creates a pending invitation for an email + role and sends the
 * invite email. The role is stored in the DB — the invitee cannot change it.
 */
export async function sendInvite(req: Request, res: Response): Promise<void> {
  if (!req.user) throw ApiError.unauthorized();
  const orgId = req.user.orgId;

  const parsed = InviteSchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  }
  const { email, role } = parsed.data;

  // Check for an existing active (pending, non-expired) invite for this email in this org
  const existing = await Invitations.findPendingInvitation(orgId, email);
  if (existing) {
    throw ApiError.conflict(
      `A pending invitation already exists for ${email}. Revoke it first to resend.`,
      'invite_pending',
    );
  }

  const { invitation, token } = await Invitations.createInvitation({
    orgId,
    email,
    role,
    invitedBy: req.user.id,
  });

  const org = await Orgs.findOrgById(orgId);
  const baseUrl = env.APP_BASE_URL ?? 'http://localhost:3000';
  const inviteUrl = `${baseUrl}/signup?invite=${token}`;

  // Fire-and-forget — email failures are logged but don't block the response
  sendInviteEmail({
    to: email,
    orgName: org?.name ?? 'Your Organization',
    role,
    inviteUrl,
  }).catch(() => {/* logged inside mailer */});

  logAuditEvent({
    userId: req.user.id,
    orgId,
    action: 'invite.sent',
    targetType: 'invitation',
    details: { email, role, invitationId: invitation.id },
  });

  res.status(201).json({
    status: 'ok',
    data: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      inviteUrl,
    },
  });
}

/**
 * GET /api/org/invitations
 * Admin-only. Lists all invitations for the current org.
 */
export async function listInvitations(req: Request, res: Response): Promise<void> {
  if (!req.user) throw ApiError.unauthorized();
  const invitations = await Invitations.listInvitations(req.user.orgId);
  const baseUrl = env.APP_BASE_URL ?? 'http://localhost:3000';

  const enriched = invitations.map((inv) => ({
    ...inv,
    inviteUrl: inv.token ? `${baseUrl}/signup?invite=${inv.token}` : undefined,
  }));

  res.status(200).json({ status: 'ok', data: enriched });
}

/**
 * DELETE /api/org/invitations/:id
 * Admin-only. Revokes a pending invitation (marks it expired).
 */
export async function revokeInvitation(req: Request, res: Response): Promise<void> {
  if (!req.user) throw ApiError.unauthorized();
  const { id } = req.params;
  if (!id) throw ApiError.badRequest('Invitation ID is required.');

  // Verify the invitation belongs to this org before revoking
  const invitations = await Invitations.listInvitations(req.user.orgId);
  const target = invitations.find((inv) => inv.id === id);
  if (!target) throw ApiError.notFound('Invitation not found.');
  if (target.status !== 'pending') {
    throw ApiError.badRequest(`Invitation is already ${target.status} and cannot be revoked.`);
  }

  const revoked = await Invitations.expireInvitation(id);
  if (!revoked) throw ApiError.notFound('Invitation not found or already closed.');

  logAuditEvent({
    userId: req.user.id,
    orgId: req.user.orgId,
    action: 'invite.revoked',
    targetType: 'invitation',
    details: { invitationId: id, email: target.email },
  });

  res.status(200).json({ status: 'ok', message: 'Invitation revoked.' });
}
