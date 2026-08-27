import { query } from '../config/db.js';

export interface RefreshTokenRow {
  id: number;
  user_id: number;
  token_hash: string;
  revoked: boolean;
  expires_at: Date;
  created_at: Date;
}

export async function createRefreshToken(input: {
  userId: number;
  tokenHash: string;
  expiresAt: Date;
}): Promise<RefreshTokenRow> {
  const { rows } = await query<RefreshTokenRow>(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.userId, input.tokenHash, input.expiresAt],
  );
  return rows[0]!;
}

export async function findByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
  const { rows } = await query<RefreshTokenRow>(
    'SELECT * FROM refresh_tokens WHERE token_hash = $1 LIMIT 1',
    [tokenHash],
  );
  return rows[0] ?? null;
}

export async function revokeById(id: number): Promise<void> {
  await query('UPDATE refresh_tokens SET revoked = true WHERE id = $1', [id]);
}

/** Revoke every session for a user — used on suspension (TICKET-007). */
export async function revokeAllForUser(userId: number): Promise<number> {
  const { rowCount } = await query(
    'UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false',
    [userId],
  );
  return rowCount ?? 0;
}

/**
 * Session validity for a given session id, joined to the owning user. Read on
 * every authenticated request so a revoked session, an expired token, a
 * suspended account, or a changed role all take effect on the next request.
 */
export interface SessionStatus {
  revoked: boolean;
  expires_at: Date;
  user_id: number;
  is_active: boolean;
  role: string;
}

export async function getSessionStatus(sid: number): Promise<SessionStatus | null> {
  const { rows } = await query<SessionStatus>(
    `SELECT rt.revoked, rt.expires_at, u.id AS user_id, u.is_active, u.role
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
      WHERE rt.id = $1
      LIMIT 1`,
    [sid],
  );
  return rows[0] ?? null;
}
