import type { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { TenantDatabaseModel, getNextSequence } from '../config/mongoSchemas.js';
import { encryptConnectionString } from '../utils/kmsEncryption.js';
import { validateConnectionStringSSRF } from '../utils/ssrfGuard.js';
import { tenantConnectionManager } from '../utils/tenantConnectionManager.js';
import { logAuditEvent } from '../utils/auditLogger.js';

const ConnectDbSchema = z.object({
  connection_string: z.string().min(1, 'Connection string is required'),
});

export async function connectTenantDb(req: Request, res: Response): Promise<void> {
  const parsed = ConnectDbSchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest('Connection string is required');
  }

  const userId = req.user?.id;
  if (!userId) throw ApiError.unauthorized('Authentication required');

  const rawConnString = parsed.data.connection_string.trim();

  // 1. SSRF Protection Validation
  try {
    await validateConnectionStringSSRF(rawConnString);
  } catch (err) {
    // Record failed status in DB if record exists
    await updateTenantDbStatus(userId, 'failed');
    throw ApiError.badRequest(err instanceof Error ? err.message : 'Invalid connection string');
  }

  // 2. Test Connection (5s timeout)
  try {
    await tenantConnectionManager.testConnection(rawConnString);
  } catch (err) {
    await updateTenantDbStatus(userId, 'failed');
    throw ApiError.badRequest(
      err instanceof Error ? err.message : 'Failed to connect to tenant MongoDB instance',
    );
  }

  // 3. Encrypt & Save Verified Credentials
  const { encryptedString, keyId } = encryptConnectionString(rawConnString);
  const now = new Date();

  let existing = await TenantDatabaseModel.findOne({ user_id: userId });
  if (existing) {
    existing.encrypted_connection_string = encryptedString;
    existing.encryption_key_id = keyId;
    existing.connection_status = 'verified';
    existing.last_verified_at = now;
    existing.updated_at = now;
    await existing.save();
  } else {
    const nextId = await getNextSequence('tenant_databases');
    existing = await TenantDatabaseModel.create({
      id: nextId,
      user_id: userId,
      db_type: 'mongodb',
      encrypted_connection_string: encryptedString,
      encryption_key_id: keyId,
      connection_status: 'verified',
      last_verified_at: now,
      created_at: now,
      updated_at: now,
    });
  }

  logAuditEvent({
    userId,
    action: 'tenant_db.connect',
    targetType: 'tenant_db',
    targetId: existing.id,
    details: { status: 'verified' },
  });

  res.status(200).json({
    status: 'ok',
    data: {
      connection_status: 'verified',
      last_verified_at: existing.last_verified_at,
      created_at: existing.created_at,
    },
  });
}

export async function getTenantDbStatus(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) throw ApiError.unauthorized('Authentication required');

  const doc = await TenantDatabaseModel.findOne({ user_id: userId });
  res.status(200).json({
    status: 'ok',
    data: {
      connection_status: doc ? doc.connection_status : 'not_configured',
      last_verified_at: doc?.last_verified_at ?? null,
      created_at: doc?.created_at ?? null,
    },
  });
}

export async function disconnectTenantDb(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) throw ApiError.unauthorized('Authentication required');

  await tenantConnectionManager.closeTenantConnection(userId);
  const doc = await TenantDatabaseModel.findOneAndDelete({ user_id: userId });

  if (doc) {
    logAuditEvent({
      userId,
      action: 'tenant_db.disconnect',
      targetType: 'tenant_db',
      targetId: doc.id,
    });
  }

  res.status(200).json({
    status: 'ok',
    message: 'Tenant database disconnected successfully',
  });
}

async function updateTenantDbStatus(userId: number, status: 'verified' | 'failed'): Promise<void> {
  await TenantDatabaseModel.updateOne(
    { user_id: userId },
    { $set: { connection_status: status, updated_at: new Date() } },
  );
}
