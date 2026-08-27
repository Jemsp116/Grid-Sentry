import type { NextFunction, Request, Response } from 'express';
import { hasPermission, type Permission } from '../auth/permissions.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Route guard (TICKET-002). Declares the Permission a route requires; rejects
 * with 403 BEFORE any handler/DB logic runs if the caller's role lacks it.
 * Must be mounted after `authenticate` so `req.user` is populated.
 *
 *   router.get('/audit', authenticate, requirePermission('audit:read'), handler)
 */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized());
      return;
    }
    if (!hasPermission(req.user.role, permission)) {
      next(ApiError.forbidden("You don't have permission to view this."));
      return;
    }
    next();
  };
}
