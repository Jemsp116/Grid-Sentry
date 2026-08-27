import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  ROLE_PERMISSIONS,
  ROLES,
  type Permission,
} from '../auth/permissions.js';

describe('permissions matrix', () => {
  it('viewer is read-only and cannot manage rules, users, or audit', () => {
    expect(hasPermission('viewer', 'dashboard:read')).toBe(true);
    expect(hasPermission('viewer', 'logs:read')).toBe(true);
    expect(hasPermission('viewer', 'alerts:read')).toBe(true);

    expect(hasPermission('viewer', 'alerts:write')).toBe(false);
    expect(hasPermission('viewer', 'blocklist:write')).toBe(false);
    expect(hasPermission('viewer', 'rules:read')).toBe(false);
    expect(hasPermission('viewer', 'rules:write')).toBe(false);
    expect(hasPermission('viewer', 'users:read')).toBe(false);
    expect(hasPermission('viewer', 'audit:read')).toBe(false);
  });

  it('analyst can triage + blocklist but cannot manage rules or users', () => {
    expect(hasPermission('analyst', 'alerts:write')).toBe(true);
    expect(hasPermission('analyst', 'blocklist:write')).toBe(true);
    expect(hasPermission('analyst', 'alerts:read')).toBe(true);

    expect(hasPermission('analyst', 'rules:read')).toBe(false);
    expect(hasPermission('analyst', 'rules:write')).toBe(false);
    expect(hasPermission('analyst', 'users:read')).toBe(false);
    expect(hasPermission('analyst', 'users:write')).toBe(false);
    expect(hasPermission('analyst', 'audit:read')).toBe(false);
  });

  it('admin can do everything defined', () => {
    const everyPermission = new Set<Permission>(
      Object.values(ROLE_PERMISSIONS).flatMap((list) => [...list]),
    );
    for (const perm of everyPermission) {
      expect(hasPermission('admin', perm)).toBe(true);
    }
  });

  it('role escalation is strict: analyst ⊇ viewer, admin ⊇ analyst', () => {
    for (const perm of ROLE_PERMISSIONS.viewer) {
      expect(hasPermission('analyst', perm)).toBe(true);
    }
    for (const perm of ROLE_PERMISSIONS.analyst) {
      expect(hasPermission('admin', perm)).toBe(true);
    }
  });

  it('has exactly three roles', () => {
    expect([...ROLES]).toEqual(['viewer', 'analyst', 'admin']);
  });
});
