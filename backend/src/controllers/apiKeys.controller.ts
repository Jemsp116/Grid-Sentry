import type { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import * as ApiKeysModel from '../models/apiKeys.model.js';
import { logAuditEvent } from '../utils/auditLogger.js';

const CreateApiKeySchema = z.object({
  app_name: z.string().min(1, 'App name is required').max(100, 'App name is too long'),
});

export async function createApiKey(req: Request, res: Response): Promise<void> {
  const parsed = CreateApiKeySchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw ApiError.badRequest(`Invalid API key input: ${issues}`);
  }

  const userId = req.user?.id;
  if (!userId) throw ApiError.unauthorized('Authentication required');

  const key = await ApiKeysModel.createApiKey(parsed.data.app_name, userId);

  logAuditEvent({
    userId,
    action: 'api_key.create',
    targetType: 'api_key',
    targetId: key.id,
    details: { app_name: key.app_name },
  });

  res.status(201).json({ status: 'ok', data: key });
}

export async function listApiKeys(_req: Request, res: Response): Promise<void> {
  const keys = await ApiKeysModel.listApiKeys();
  res.status(200).json({ status: 'ok', data: keys });
}

export async function revokeApiKey(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id || '', 10);
  if (isNaN(id)) {
    throw ApiError.badRequest('Invalid API key ID');
  }

  const updatedKey = await ApiKeysModel.revokeApiKey(id);
  if (!updatedKey) {
    throw ApiError.notFound('API key not found');
  }

  logAuditEvent({
    userId: req.user?.id ?? null,
    action: 'api_key.revoke',
    targetType: 'api_key',
    targetId: id,
    details: { app_name: updatedKey.app_name },
  });

  res.status(200).json({ status: 'ok', data: updatedKey });
}
