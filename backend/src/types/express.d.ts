import type { Role } from '../auth/permissions.js';

/**
 * The authenticated principal attached to every request by the auth middleware.
 * `role` is re-read from the database on each request (not trusted from the
 * token) so role changes and suspensions take effect on the next action.
 * `orgId` is the MongoDB ObjectId string of the user's organization — used to
 * scope every DB query server-side, never sourced from client input.
 */
export interface AuthUser {
  id: number;
  role: Role;
  orgId: string;
  /** Session id = the refresh_tokens row backing this session (for revocation). */
  sid: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};

