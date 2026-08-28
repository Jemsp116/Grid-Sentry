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

// Analyst-and-up

// Admin-only

export default router;
