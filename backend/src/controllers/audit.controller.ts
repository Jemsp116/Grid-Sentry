import type { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import * as AuditModel from '../models/audit.model.js';

const AuditQuerySchema = z.object({
  action: z.string().optional(),
  targetType: z.string().optional(),
  userId: z.coerce.number().int().positive().optional(),
  from: z.string().datetime({ offset: true }).optional()
    .or(z.string().datetime().optional()),
  to: z.string().datetime({ offset: true }).optional()
    .or(z.string().datetime().optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  const parsed = AuditQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw ApiError.badRequest(`Invalid audit query parameters: ${issues}`);
  }

  const userId = req.user?.id ?? null;
  await AuditModel.seedDemoAuditLogsIfEmpty(userId);

  const result = await AuditModel.getAuditLogs({
    action: parsed.data.action,
    targetType: parsed.data.targetType,
    userId: parsed.data.userId,
    from: parsed.data.from,
    to: parsed.data.to,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
  });

  res.status(200).json({ status: 'ok', data: result });
}
