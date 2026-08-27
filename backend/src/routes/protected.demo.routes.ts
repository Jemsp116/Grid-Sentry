import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

/**
 * Placeholder protected routes that exercise the RBAC matrix end-to-end
 * (TICKET-002). Each real feature ticket (005 rules, 007 users, 009 audit)
 * will replace the corresponding handler with actual logic — but the guard
 * pattern (`authenticate` + `requirePermission`) stays exactly the same.
 */
const router = Router();

const ok = (resource: string) => (req: import('express').Request, res: import('express').Response) =>
  res.status(200).json({ ok: true, resource, role: req.user?.role });

// Viewer-and-up
router.get('/dashboard/summary', authenticate, requirePermission('dashboard:read'), ok('dashboard'));
router.get('/logs/search', authenticate, requirePermission('logs:read'), ok('logs'));
router.get('/alerts', authenticate, requirePermission('alerts:read'), ok('alerts'));

// Analyst-and-up
router.patch('/alerts/:id/status', authenticate, requirePermission('alerts:write'), ok('alerts:write'));
router.post('/blocklist', authenticate, requirePermission('blocklist:write'), ok('blocklist:write'));

// Admin-only
router.get('/rules', authenticate, requirePermission('rules:read'), ok('rules'));
router.post('/rules', authenticate, requirePermission('rules:write'), ok('rules:write'));
router.get('/users', authenticate, requirePermission('users:read'), ok('users'));
router.get('/audit', authenticate, requirePermission('audit:read'), ok('audit'));

export default router;
