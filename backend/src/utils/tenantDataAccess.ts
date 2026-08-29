import type { Model } from 'mongoose';
import {
  TenantDatabaseModel,
  AlertModel,
  RuleModel,
  AuditLogModel,
  type IAlertDoc,
  type IRuleDoc,
  type IAuditLogDoc,
} from '../config/mongoSchemas.js';
import { decryptConnectionString } from './kmsEncryption.js';
import { tenantConnectionManager } from './tenantConnectionManager.js';

export interface TenantModels {
  Alerts: Model<IAlertDoc>;
  Rules: Model<IRuleDoc>;
  AuditLog: Model<IAuditLogDoc>;
  isTenantDb: boolean;
}

/**
 * Resolves the appropriate database models for a given user.
 * If the user has an active, verified BYODB MongoDB configured, returns models bound
 * to their private tenant connection pool. Otherwise, returns default shared models.
 */
export async function getTenantModels(userId?: number | null): Promise<TenantModels> {
  if (!userId) {
    return {
      Alerts: AlertModel,
      Rules: RuleModel,
      AuditLog: AuditLogModel,
      isTenantDb: false,
    };
  }

  const tenantDbConfig = await TenantDatabaseModel.findOne({
    user_id: userId,
    connection_status: 'verified',
  });

  if (!tenantDbConfig) {
    return {
      Alerts: AlertModel,
      Rules: RuleModel,
      AuditLog: AuditLogModel,
      isTenantDb: false,
    };
  }

  try {
    const rawConnectionString = decryptConnectionString(tenantDbConfig.encrypted_connection_string);
    const conn = await tenantConnectionManager.getTenantConnection(userId, rawConnectionString);

    // Bind models onto tenant's connection instance
    const TenantAlerts =
      (conn.models.Alert as Model<IAlertDoc>) ||
      conn.model<IAlertDoc>('Alert', AlertModel.schema);

    const TenantRules =
      (conn.models.Rule as Model<IRuleDoc>) ||
      conn.model<IRuleDoc>('Rule', RuleModel.schema);

    const TenantAuditLog =
      (conn.models.AuditLog as Model<IAuditLogDoc>) ||
      conn.model<IAuditLogDoc>('AuditLog', AuditLogModel.schema);

    return {
      Alerts: TenantAlerts,
      Rules: TenantRules,
      AuditLog: TenantAuditLog,
      isTenantDb: true,
    };
  } catch {
    // If tenant DB fails to resolve, fallback safely to shared models
    return {
      Alerts: AlertModel,
      Rules: RuleModel,
      AuditLog: AuditLogModel,
      isTenantDb: false,
    };
  }
}
