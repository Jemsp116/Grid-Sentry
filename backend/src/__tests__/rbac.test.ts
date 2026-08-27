import { describe, it, expect } from 'vitest';
import type { Request, Response } from 'express';
import { requirePermission } from '../middleware/rbac.js';
import { ApiError } from '../utils/ApiError.js';
import type { Permission, Role } from '../auth/permissions.js';
import type { AuthUser } from '../types/express.js';

/** Drive requirePermission with a fake request and capture what next() got. */
function run(role: Role | null, permission: Permission): ApiError | null {
  const req = {
    user: role ? ({ id: 1, role, sid: 1 } satisfies AuthUser) : undefined,
  } as Request;
  const res = {} as Response;
  let captured: unknown;
  requirePermission(permission)(req, res, (err?: unknown) => {
    captured = err;
  });
  return captured instanceof ApiError ? captured : null;
}

const allowed = (role: Role, p: Permission) => expect(run(role, p)).toBeNull();
const denied = (role: Role, p: Permission) => {
  const err = run(role, p);
  expect(err).toBeInstanceOf(ApiError);
  expect(err?.status).toBe(403);
};

describe('requirePermission middleware (RBAC route guard)', () => {
  it('rejects unauthenticated requests with 401', () => {
    const err = run(null, 'dashboard:read');
    expect(err?.status).toBe(401);
  });

  describe('Viewer', () => {
    it('may view dashboard, logs, alerts', () => {
      allowed('viewer', 'dashboard:read');
      allowed('viewer', 'logs:read');
      allowed('viewer', 'alerts:read');
    });
    it('cannot reach rule-management, user-management, or audit routes', () => {
      denied('viewer', 'rules:read');
      denied('viewer', 'rules:write');
      denied('viewer', 'users:read');
      denied('viewer', 'audit:read');
      denied('viewer', 'alerts:write');
    });
  });

  describe('Analyst', () => {
    it('may triage alerts and manage the blocklist', () => {
      allowed('analyst', 'alerts:write');
      allowed('analyst', 'blocklist:write');
    });
    it('cannot reach rule-management or user-management routes', () => {
      denied('analyst', 'rules:read');
      denied('analyst', 'rules:write');
      denied('analyst', 'users:read');
      denied('analyst', 'users:write');
      denied('analyst', 'audit:read');
    });
  });

  describe('Admin', () => {
    it('may reach every guarded route', () => {
      allowed('admin', 'rules:write');
      allowed('admin', 'users:write');
      allowed('admin', 'audit:read');
      allowed('admin', 'blocklist:write');
      allowed('admin', 'dashboard:read');
    });
  });
});
