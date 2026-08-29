/**
 * Central permission definitions (TICKET-002).
 *
 * This is the single source of truth for "which role may do what". Route
 * handlers never hardcode role checks — they declare a required Permission and
 * the `requirePermission` middleware consults this map. Keeping it in one file
 * means the entire authorization surface is auditable at a glance.
 */

export const ROLES = ['viewer', 'analyst', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Fine-grained permissions, named `resource:action`. Add new capabilities here
 * as tickets land (e.g. TICKET-005 adds rule management under `rules:*`).
 */
export type Permission =
  | 'dashboard:read'
  | 'logs:read'
  | 'geoip:read'
  | 'alerts:read'
  | 'alerts:write' // change status / add notes
  | 'blocklist:read'
  | 'blocklist:write'
  | 'rules:read'
  | 'rules:write'
  | 'users:read'
  | 'users:write' // create / suspend / change role
  | 'audit:read'
  | 'apikeys:read'
  | 'apikeys:write';

/** Permissions granted to a Viewer — read-only visibility. */
const VIEWER: Permission[] = ['dashboard:read', 'logs:read', 'geoip:read', 'alerts:read'];

/** Analyst = Viewer + triage actions + manual IP blocklisting. */
const ANALYST: Permission[] = [
  ...VIEWER,
  'alerts:write',
  'blocklist:read',
  'blocklist:write',
];

/** Admin = Analyst + rule management, user management, audit log, api keys. */
const ADMIN: Permission[] = [
  ...ANALYST,
  'rules:read',
  'rules:write',
  'users:read',
  'users:write',
  'audit:read',
  'apikeys:read',
  'apikeys:write',
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlyArray<Permission>> = {
  viewer: VIEWER,
  analyst: ANALYST,
  admin: ADMIN,
};

/** True if `role` is allowed to perform `permission`. */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
