import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError.js';

/**
 * Org-scope guard — must be mounted AFTER `authenticate`.
 *
 * Guarantees `req.user.orgId` is a non-empty string before any handler runs.
 * This provides a hard fail-safe in case authenticate is accidentally skipped:
 * no request with an empty orgId will ever reach a data-access handler.
 *
 * Usage:
 *   router.get('/alerts', authenticate, requireOrgScope(), requirePermission('alerts:read'), handler)
 */
export function requireOrgScope() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user?.orgId || req.user.orgId.trim() === '') {
      next(ApiError.unauthorized('Organization context is required.', 'no_org_scope'));
      return;
    }
    next();
  };
}
