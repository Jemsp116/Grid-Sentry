import { AuditLogModel, getNextSequence } from '../config/mongoSchemas.js';
import { logger } from '../config/logger.js';

export interface AuditEventInput {
  userId?: number | null;
  orgId?: string | null;
  action: string;
  targetType: string;
  targetId?: number | null;
  details?: Record<string, unknown> | null;
}

/**
 * Structured audit logging helper (TICKET-009).
 * Inserts immutable audit log entry into MongoDB without blocking HTTP responses.
 */
export async function logAuditEvent(event: AuditEventInput): Promise<void> {
  try {
    const nextId = await getNextSequence('audit_log');
    await AuditLogModel.create({
      id: nextId,
      orgId: event.orgId ?? null,
      user_id: event.userId ?? null,
      action: event.action,
      target_type: event.targetType,
      target_id: event.targetId ?? null,
      details: event.details ?? null,
    });
  } catch (err) {
    logger.error('Failed to write audit log entry', {
      event,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}


