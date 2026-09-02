import type { CookieOptions, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyPassword, hashPassword } from '../utils/password.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
  signAccessToken,
} from '../utils/tokens.js';
import * as Users from '../models/users.model.js';
import * as Tokens from '../models/refreshTokens.model.js';
import * as Orgs from '../models/organizations.model.js';
import * as Invitations from '../models/invitations.model.js';
import { logAuditEvent } from '../utils/auditLogger.js';

const REFRESH_COOKIE = 'gs_refresh';

/** Constant-time-ish guard against user enumeration. */
const DUMMY_HASH = hashPassword('invalid-account-placeholder-password');

function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: refreshTokenExpiry().getTime() - Date.now(),
  };
}

// ─── Signup ──────────────────────────────────────────────────────────────────
const SignupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('A valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  /** Present when signing up via an invite link; absent for org founders. */
  inviteToken: z.string().optional(),
  /** Org name — only used when inviteToken is absent (new org creation). */
  orgName: z.string().min(1).max(200).optional(),
});

/**
 * POST /api/auth/signup
 *
 * Two modes:
 *   A. No inviteToken → create a new org + make this user its admin.
 *   B. inviteToken present → validate the invitation, create the user with the
 *      org/role from the invitation (never from client body), mark invite accepted.
 */
export async function signup(req: Request, res: Response): Promise<void> {
  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  }
  const { name, email, password, inviteToken, orgName } = parsed.data;

  // Check global email uniqueness regardless of path
  const existingUser = await Users.findByEmail(email);
  if (existingUser) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const passwordHash = await hashPassword(password);
  let orgId: string;
  let role: 'admin' | 'analyst' | 'viewer';
  let invitedBy: number | null = null;

  if (inviteToken) {
    // ── Path B: Invite-based signup ──
    const invitation = await Invitations.findInvitationByToken(inviteToken);
    if (!invitation) {
      throw ApiError.badRequest('Invitation token is invalid or has expired.', 'invalid_token');
    }
    if (invitation.status === 'accepted') {
      throw ApiError.conflict('This invitation has already been used.', 'token_used');
    }
    if (invitation.status === 'expired' || invitation.expiresAt.getTime() <= Date.now()) {
      throw ApiError.gone('This invitation has expired. Ask your admin to resend.', 'token_expired');
    }
    // Hard check: email MUST match the invitation — never allow the client to
    // choose a different email than the one the admin invited.
    if (invitation.email !== email.toLowerCase().trim()) {
      throw ApiError.forbidden(
        'This invitation was sent to a different email address.',
        'email_mismatch',
      );
    }

    orgId = invitation.orgId;
    role = invitation.role;
    invitedBy = invitation.invitedBy;

    // Mark invitation as consumed (single-use) atomically before creating the user
    const consumed = await Invitations.acceptInvitation(invitation.id);
    if (!consumed) {
      // Race condition — another request already accepted it
      throw ApiError.conflict('This invitation has already been used.', 'token_used');
    }
  } else {
    // ── Path A: New org signup ──
    if (!orgName?.trim()) {
      throw ApiError.badRequest('Organization name is required when signing up without an invitation.');
    }
    // Create org placeholder (createdBy = 0 until we have the user id)
    const org = await Orgs.createOrg(orgName.trim(), 0);
    orgId = org.id;
    role = 'admin';
  }

  // Create the user
  const newUser = await Users.createUser({
    orgId,
    name,
    email,
    passwordHash,
    role,
    invitedBy,
  });

  // If this was a new org, backfill createdBy now that we have the user id
  if (!inviteToken) {
    await Orgs.setOrgCreator(orgId, newUser.id);
  }

  // Issue session tokens
  const { token: refreshToken, hash } = generateRefreshToken();
  const session = await Tokens.createRefreshToken({
    userId: newUser.id,
    tokenHash: hash,
    expiresAt: refreshTokenExpiry(),
  });

  const accessToken = signAccessToken({
    sub: newUser.id,
    role: newUser.role,
    orgId: newUser.orgId,
    sid: session.id,
  });

  logAuditEvent({
    userId: newUser.id,
    orgId: newUser.orgId,
    action: inviteToken ? 'auth.signup_via_invite' : 'auth.signup_new_org',
    targetType: 'user',
    targetId: newUser.id,
    details: { email: newUser.email, role: newUser.role, orgId: newUser.orgId },
  });

  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  res.status(201).json({
    accessToken,
    user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, orgId: newUser.orgId },
  });
}

// ─── Login ───────────────────────────────────────────────────────────────────
const LoginSchema = z.object({
  email: z.string().email('A valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

/** POST /api/auth/login */
export async function login(req: Request, res: Response): Promise<void> {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  }
  const { email, password } = parsed.data;

  const user = await Users.findByEmail(email);

  // Always compare against *some* hash to keep timing uniform.
  const ok = await verifyPassword(password, user?.password_hash ?? (await DUMMY_HASH));
  if (!user || !ok) {
    throw ApiError.unauthorized('Incorrect email or password', 'invalid_credentials');
  }

  if (!user.is_active) {
    throw ApiError.forbidden(
      'This account has been suspended. Contact your administrator.',
      'account_suspended',
    );
  }

  const { token: refreshToken, hash } = generateRefreshToken();
  const session = await Tokens.createRefreshToken({
    userId: user.id,
    tokenHash: hash,
    expiresAt: refreshTokenExpiry(),
  });

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    orgId: user.orgId,
    sid: session.id,
  });

  logAuditEvent({
    userId: user.id,
    orgId: user.orgId,
    action: 'auth.login_success',
    targetType: 'user',
    targetId: user.id,
    details: { email: user.email, role: user.role },
  });

  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  res.status(200).json({
    accessToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, orgId: user.orgId },
  });
}

// ─── Refresh ─────────────────────────────────────────────────────────────────
/** POST /api/auth/refresh — issue a fresh access token from a valid session. */
export async function refresh(req: Request, res: Response): Promise<void> {
  const raw = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? undefined;
  if (!raw) throw ApiError.unauthorized('Your session has ended. Please log in again.', 'no_session');

  const row = await Tokens.findByHash(hashRefreshToken(raw));
  if (!row || row.revoked || row.expires_at.getTime() <= Date.now()) {
    throw ApiError.unauthorized('Your session has ended. Please log in again.', 'session_revoked');
  }

  const user = await Users.findById(row.user_id);
  if (!user || !user.is_active) {
    throw ApiError.unauthorized('Your session has ended. Please log in again.', 'account_inactive');
  }

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    orgId: user.orgId,
    sid: row.id,
  });
  res.status(200).json({ accessToken });
}

// ─── Logout ──────────────────────────────────────────────────────────────────
/** POST /api/auth/logout — revoke the current session's refresh token. */
export async function logout(req: Request, res: Response): Promise<void> {
  const raw = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? undefined;
  if (raw) {
    const row = await Tokens.findByHash(hashRefreshToken(raw));
    if (row && !row.revoked) await Tokens.revokeById(row.id);
  }

  if (req.user?.id) {
    logAuditEvent({
      userId: req.user.id,
      orgId: req.user.orgId,
      action: 'auth.logout',
      targetType: 'user',
      targetId: req.user.id,
    });
  }

  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
  res.status(204).send();
}

// ─── Me ──────────────────────────────────────────────────────────────────────
/** GET /api/auth/me — current authenticated principal (requires auth). */
export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) throw ApiError.unauthorized();
  const user = await Users.findById(req.user.id);
  if (!user) throw ApiError.unauthorized();
  res.status(200).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      orgId: user.orgId,
    },
  });
}

// ─── Get Invite Info ─────────────────────────────────────────────────────────
/**
 * GET /api/auth/invite/:token — public endpoint.
 * Returns invitation metadata so the frontend can prefill org name, role, and
 * email on the signup form. No authentication required.
 */
export async function getInviteInfo(req: Request, res: Response): Promise<void> {
  const { token } = req.params;
  if (!token) throw ApiError.badRequest('Invitation token is required.');

  const invitation = await Invitations.findInvitationByToken(token);
  if (!invitation) {
    throw ApiError.notFound('Invitation not found or has expired.', 'invalid_token');
  }
  if (invitation.status === 'accepted') {
    throw ApiError.conflict('This invitation has already been used.', 'token_used');
  }
  if (invitation.status === 'expired' || invitation.expiresAt.getTime() <= Date.now()) {
    throw ApiError.gone('This invitation has expired. Ask your admin to resend.', 'token_expired');
  }

  const org = await Orgs.findOrgById(invitation.orgId);

  res.status(200).json({
    email: invitation.email,
    role: invitation.role,
    orgId: invitation.orgId,
    orgName: org?.name ?? 'Unknown Organization',
    expiresAt: invitation.expiresAt,
  });
}
