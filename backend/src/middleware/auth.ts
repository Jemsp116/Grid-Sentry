import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/tokens.js';
import { getSessionStatus } from '../models/refreshTokens.model.js';
import { ApiError } from '../utils/ApiError.js';
import type { Role } from '../auth/permissions.js';

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

/**
 * Authenticate a request from its access token, then re-validate the session
 * against the database. This DB read (see Technical Architecture §4) is what
 * lets us instantly enforce suspensions and role changes rather than waiting
 * for the 15-minute access token to expire:
 *   - session revoked / missing / expired  -> 401 (logged out)
 *   - owning account suspended              -> 401 (logged out)
 *   - role taken from DB, not from the token (role changes apply immediately)
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractBearer(req);
    if (!token) throw ApiError.unauthorized();

    let payload: { sub: number; role: Role; sid: number };
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw ApiError.unauthorized('Your session has ended. Please log in again.', 'token_invalid');
    }

    const session = await getSessionStatus(payload.sid);
    if (!session || session.revoked || session.expires_at.getTime() <= Date.now()) {
      throw ApiError.unauthorized('Your session has ended. Please log in again.', 'session_revoked');
    }
    if (!session.is_active) {
      throw ApiError.unauthorized('This account has been suspended.', 'account_suspended');
    }

    req.user = { id: session.user_id, role: session.role as Role, sid: payload.sid };
    next();
  } catch (err) {
    next(err);
  }
}
