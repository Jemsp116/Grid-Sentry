import type { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import * as BlocklistModel from '../models/blocklist.model.js';

const AddBlockSchema = z.object({
  ipAddress: z.string().ip({ message: 'Must be a valid IPv4 or IPv6 address' }),
  reason: z.string().max(500).optional(),
  expiresAt: z.string().datetime({ offset: true }).optional()
    .or(z.string().datetime().optional())
    .nullable(),
});

export async function listBlocklist(_req: Request, res: Response): Promise<void> {
  const list = await BlocklistModel.getBlocklist();
  res.status(200).json({ status: 'ok', data: list });
}

import { logAuditEvent } from '../utils/auditLogger.js';

export async function addBlock(req: Request, res: Response): Promise<void> {
  const parsed = AddBlockSchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw ApiError.badRequest(`Invalid IP block input: ${issues}`);
  }

  const userId = req.user?.id ?? null;
  const { entry, alreadyBlocked } = await BlocklistModel.addBlocklistIp(
    parsed.data.ipAddress,
    parsed.data.reason ?? null,
    userId,
    parsed.data.expiresAt ?? null,
  );

  if (!alreadyBlocked) {
    logAuditEvent({
      userId,
      action: 'blocklist.ip_blocked',
      targetType: 'ip_blocklist',
      targetId: entry.id,
      details: { ipAddress: entry.ip_address, reason: entry.reason },
    });
  }

  res.status(200).json({
    status: 'ok',
    alreadyBlocked,
    message: alreadyBlocked ? `IP ${parsed.data.ipAddress} is already on the blocklist` : 'IP added to blocklist',
    data: entry,
  });
}

export async function removeBlock(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id ?? '', 10);
  if (isNaN(id)) throw ApiError.badRequest('Invalid blocklist entry ID');

  const removed = await BlocklistModel.removeBlocklistIp(id);
  if (!removed) throw ApiError.notFound('Blocklist entry not found');

  logAuditEvent({
    userId: req.user?.id ?? null,
    action: 'blocklist.ip_unblocked',
    targetType: 'ip_blocklist',
    targetId: id,
  });

  res.status(200).json({ status: 'ok', message: 'IP removed from blocklist' });
}
