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

const REFRESH_COOKIE = 'gs_refresh';

/** Constant-time-ish guard against user enumeration: always do a bcrypt compare,
 * even when the email doesn't exist, so response timing doesn't leak validity. */
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

const LoginSchema = z.object({
  email: z.string().email('A valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

import { logAuditEvent } from '../utils/auditLogger.js';

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

  // Suspended accounts get a specific (non-enumerating) message.
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

  const accessToken = signAccessToken({ sub: user.id, role: user.role, sid: session.id });

  // Audit log login success
  logAuditEvent({
    userId: user.id,
    action: 'auth.login_success',
    targetType: 'user',
    targetId: user.id,
    details: { email: user.email, role: user.role },
  });

  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  res.status(200).json({
    accessToken,
    user: { id: user.id, email: user.email, role: user.role },
  });
}

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

  const accessToken = signAccessToken({ sub: user.id, role: user.role, sid: row.id });
  res.status(200).json({ accessToken });
}

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
      action: 'auth.logout',
      targetType: 'user',
      targetId: req.user.id,
    });
  }

  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
  res.status(204).send();
}

/** GET /api/auth/me — current authenticated principal (requires auth). */
export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) throw ApiError.unauthorized();
  const user = await Users.findById(req.user.id);
  if (!user) throw ApiError.unauthorized();
  res.status(200).json({ user: { id: user.id, email: user.email, role: user.role } });
}
