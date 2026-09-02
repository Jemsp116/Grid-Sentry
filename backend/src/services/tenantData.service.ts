import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { TenantDatabaseModel } from '../config/mongoSchemas.js';
import { decryptConnectionString } from '../utils/kmsEncryption.js';
import { tenantConnectionManager } from '../utils/tenantConnectionManager.js';
import { logger } from '../config/logger.js';
import type { ExternalLogPayload } from '../utils/opensearch.queries.js';

// ─── Tenant Source Log Schema for BYODB instances ────────────────────────────
export interface ITenantSourceLogDoc extends Document {
  timestamp: Date;
  event_type: string;
  source_ip: string;
  user_identifier?: string | null;
  raw_message: string;
  source_id: number;
  app_name: string;
  org_id?: string | null;
  details: Record<string, any>;
  created_at: Date;
}

const TenantSourceLogSchema = new Schema<ITenantSourceLogDoc>({
  timestamp: { type: Date, required: true, index: true },
  event_type: { type: String, required: true, index: true },
  source_ip: { type: String, required: true, index: true },
  user_identifier: { type: String, default: null, index: true },
  raw_message: { type: String, required: true },
  source_id: { type: Number, required: true, index: true },
  app_name: { type: String, required: true, index: true },
  org_id: { type: String, default: null, index: true },
  details: { type: Schema.Types.Mixed, default: {} },
  created_at: { type: Date, default: Date.now, index: true },
});

TenantSourceLogSchema.index({ app_name: 1, timestamp: -1 });
TenantSourceLogSchema.index({ source_id: 1, timestamp: -1 });

// Cache of model constructors per tenant connection to avoid Mongoose OverwriteModelError
const tenantModelCache = new WeakMap<mongoose.Connection, Model<ITenantSourceLogDoc>>();

function getTenantSourceLogModel(conn: mongoose.Connection): Model<ITenantSourceLogDoc> {
  let model = tenantModelCache.get(conn);
  if (!model) {
    model = (conn.models.SourceLog as Model<ITenantSourceLogDoc>) ||
      conn.model<ITenantSourceLogDoc>('SourceLog', TenantSourceLogSchema, 'source_logs');
    tenantModelCache.set(conn, model);
  }
  return model;
}

/**
 * Checks if a user has a verified, active BYODB MongoDB configuration.
 */
export async function hasVerifiedTenantDb(userId: number): Promise<boolean> {
  const doc = await TenantDatabaseModel.findOne({
    user_id: userId,
    connection_status: 'verified',
  });
  return Boolean(doc);
}

/**
 * Retrieves the active Mongoose connection to the tenant's private MongoDB instance.
 */
export async function getTenantDbConnection(userId: number): Promise<mongoose.Connection | null> {
  const doc = await TenantDatabaseModel.findOne({
    user_id: userId,
    connection_status: 'verified',
  });

  if (!doc || !doc.encrypted_connection_string) {
    return null;
  }

  try {
    const plainConnString = decryptConnectionString(doc.encrypted_connection_string);
    return await tenantConnectionManager.getTenantConnection(userId, plainConnString);
  } catch (err) {
    logger.error('Failed to decrypt or connect to tenant MongoDB', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Writes incoming source log events directly to the tenant's private MongoDB database.
 */
export async function writeTenantSourceLogs(
  userId: number,
  events: ExternalLogPayload[],
  sourceInfo: { sourceId: number; appName: string; orgId?: string },
): Promise<{ written: number; success: boolean }> {
  if (!events || events.length === 0) {
    return { written: 0, success: true };
  }

  const conn = await getTenantDbConnection(userId);
  if (!conn) {
    return { written: 0, success: false };
  }

  try {
    const Model = getTenantSourceLogModel(conn);
    const docs = events.map((ev) => {
      const ts = ev.timestamp ? new Date(ev.timestamp) : new Date();
      return {
        timestamp: isNaN(ts.getTime()) ? new Date() : ts,
        event_type: ev.event_type || 'custom_event',
        source_ip: ev.source_ip || '127.0.0.1',
        user_identifier: ev.user_identifier || null,
        raw_message: ev.raw_message || `Event: ${ev.event_type}`,
        source_id: sourceInfo.sourceId,
        app_name: sourceInfo.appName,
        org_id: sourceInfo.orgId || null,
        details: ev.details || {},
        created_at: new Date(),
      };
    });

    await Model.insertMany(docs, { ordered: false });
    logger.info('Wrote source logs to tenant BYODB instance', {
      userId,
      sourceId: sourceInfo.sourceId,
      appName: sourceInfo.appName,
      count: docs.length,
    });

    return { written: docs.length, success: true };
  } catch (err) {
    logger.error('Failed to write source logs to tenant MongoDB', {
      userId,
      sourceId: sourceInfo.sourceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { written: 0, success: false };
  }
}

/**
 * Reads source log events directly from the tenant's private MongoDB database.
 */
export async function getTenantSourceLogs(
  userId: number,
  options: {
    sourceId?: number;
    appName?: string;
    limit?: number;
    skip?: number;
  } = {},
): Promise<ITenantSourceLogDoc[]> {
  const conn = await getTenantDbConnection(userId);
  if (!conn) return [];

  const Model = getTenantSourceLogModel(conn);
  const filter: Record<string, any> = {};
  if (options.sourceId) filter.source_id = options.sourceId;
  if (options.appName) filter.app_name = options.appName;

  return Model.find(filter)
    .sort({ timestamp: -1 })
    .skip(options.skip || 0)
    .limit(Math.min(options.limit || 50, 500))
    .lean();
}
