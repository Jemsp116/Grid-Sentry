import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { Role } from '../auth/permissions.js';

export interface AccessTokenPayload {
  /** user id */
  sub: number;
  role: Role;
  /** session id — the refresh_tokens row backing this session */
  sid: number;
}

/** Sign a short-lived access token. */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  } as jwt.SignOptions);
}

/** Verify + decode an access token. Throws if invalid/expired. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === 'string') throw new Error('Malformed token');
  return {
    sub: Number(decoded.sub),
    role: decoded.role as Role,
    sid: Number((decoded as jwt.JwtPayload).sid),
  };
}

/** Generate an opaque refresh token (returned to client) + its storage hash. */
export function generateRefreshToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(48).toString('hex');
  return { token, hash: hashRefreshToken(token) };
}

/** SHA-256 hash used to store/look up refresh tokens (never store the raw token). */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Parse a duration like `15m`, `7d`, `30s`, `12h` into milliseconds. Used to
 * compute a refresh token's absolute expiry timestamp.
 */
export function durationToMs(duration: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(duration.trim());
  if (!match) throw new Error(`Invalid duration: ${duration}`);
  const value = Number(match[1]);
  const unit = match[2] as 's' | 'm' | 'h' | 'd';
  const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return value * factor;
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + durationToMs(env.JWT_REFRESH_EXPIRY));
}
