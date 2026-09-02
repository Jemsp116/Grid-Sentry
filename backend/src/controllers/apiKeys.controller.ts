import type { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import * as ApiKeysModel from '../models/apiKeys.model.js';
import { logAuditEvent } from '../utils/auditLogger.js';
import { hasVerifiedTenantDb } from '../services/tenantData.service.js';

const CreateApiKeySchema = z.object({
  app_name: z.string().min(1, 'App name is required').max(100, 'App name is too long'),
  connection_method: z.enum(['code', 'agent']).optional().default('code'),
});

export async function createApiKey(req: Request, res: Response): Promise<void> {
  const parsed = CreateApiKeySchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw ApiError.badRequest(`Invalid API key input: ${issues}`);
  }

  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const { orgId, id: userId } = req.user;

  const key = await ApiKeysModel.createApiKey(
    orgId,
    parsed.data.app_name,
    userId,
    parsed.data.connection_method,
  );

  logAuditEvent({
    userId,
    orgId,
    action: 'api_key.create',
    targetType: 'api_key',
    targetId: key.id,
    details: { app_name: key.app_name, connection_method: key.connection_method },
  });

  res.status(201).json({ status: 'ok', data: key });
}

export async function listApiKeys(req: Request, res: Response): Promise<void> {
  if (!req.user) throw ApiError.unauthorized();
  const [keys, hasTenantDb] = await Promise.all([
    ApiKeysModel.listApiKeys(req.user.orgId),
    hasVerifiedTenantDb(req.user.id),
  ]);

  const enhancedKeys = keys.map((k) => ({
    ...k,
    has_tenant_db: hasTenantDb,
    storage_destination: hasTenantDb ? 'tenant_db' : 'central_siem',
  }));

  res.status(200).json({ status: 'ok', data: enhancedKeys });
}

export async function getApiKeyStatus(req: Request, res: Response): Promise<void> {
  if (!req.user) throw ApiError.unauthorized();
  const id = parseInt(req.params.id || '', 10);
  if (isNaN(id)) {
    throw ApiError.badRequest('Invalid API key ID');
  }

  const [status, hasTenantDb] = await Promise.all([
    ApiKeysModel.getApiKeyStatus(id, req.user.orgId),
    hasVerifiedTenantDb(req.user.id),
  ]);

  if (!status) {
    throw ApiError.notFound('API key not found');
  }

  res.status(200).json({
    status: 'ok',
    data: {
      ...status,
      has_tenant_db: hasTenantDb,
      storage_destination: hasTenantDb ? 'tenant_db' : 'central_siem',
    },
  });
}

export async function revokeApiKey(req: Request, res: Response): Promise<void> {
  if (!req.user) throw ApiError.unauthorized();
  const id = parseInt(req.params.id || '', 10);
  if (isNaN(id)) {
    throw ApiError.badRequest('Invalid API key ID');
  }

  const updatedKey = await ApiKeysModel.revokeApiKey(id, req.user.orgId);
  if (!updatedKey) {
    throw ApiError.notFound('API key not found');
  }

  logAuditEvent({
    userId: req.user.id,
    orgId: req.user.orgId,
    action: 'api_key.revoke',
    targetType: 'api_key',
    targetId: id,
    details: { app_name: updatedKey.app_name },
  });

  res.status(200).json({ status: 'ok', data: updatedKey });
}
