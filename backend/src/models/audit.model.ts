import { AuditLogModel, getNextSequence, type IAuditLogDoc } from '../config/mongoSchemas.js';
import { loadUserEmails } from './lookups.js';

export interface AuditLogRow {
  id: number;
  user_id: number | null;
  user_email: string | null;
  action: string;
  target_type: string;
  target_id: number | null;
  details: Record<string, unknown> | null;
  created_at: Date;
}

export interface AuditLogFilterParams {
  orgId: string;
  action?: string;
  targetType?: string;
  userId?: number;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogsResponse {
  logs: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Builds an audit row from a pre-loaded user-email map. Synchronous by design —
 * see `models/lookups.ts`.
 */
function docToAuditRow(doc: IAuditLogDoc, userEmails: Map<number, string>): AuditLogRow {
  return {
    id: doc.id,
    user_id: doc.user_id ?? null,
    user_email: doc.user_id ? userEmails.get(doc.user_id) ?? null : null,
    action: doc.action,
    target_type: doc.target_type,
    target_id: doc.target_id ?? null,
    details: (doc.details as Record<string, unknown>) ?? null,
    created_at: doc.created_at,
  };
}

export async function getAuditLogs(params: AuditLogFilterParams): Promise<AuditLogsResponse> {
  const { orgId, action, targetType, userId, from, to, page = 1, pageSize = 50 } = params;

  const queryFilter: any = { orgId };
  if (action) queryFilter.action = action;
  if (targetType) queryFilter.target_type = targetType;
  if (userId) queryFilter.user_id = userId;

  if (from || to) {
    queryFilter.created_at = {};
    if (from) queryFilter.created_at.$gte = new Date(from);
    if (to) queryFilter.created_at.$lte = new Date(to);
  }

  const total = await AuditLogModel.countDocuments(queryFilter);
  const skip = (page - 1) * pageSize;

  const docs = await AuditLogModel.find(queryFilter)
    .sort({ created_at: -1, id: -1 })
    .skip(skip)
    .limit(pageSize);

  const userEmails = await loadUserEmails(docs.map((d) => d.user_id));
  const logs = docs.map((d) => docToAuditRow(d, userEmails));

  return {
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

export async function seedDemoAuditLogsIfEmpty(adminUserId: number | null, orgId: string): Promise<void> {
  const count = await AuditLogModel.countDocuments({ orgId });
  if (count > 0) return;

  const demoEvents = [
    {
      user_id: adminUserId,
      action: 'rule.created',
      target_type: 'rule',
      target_id: 1,
      details: { name: 'SSH Brute Force', threshold: 5, severity: 'high' },
    },
    {
      user_id: adminUserId,
      action: 'rule.created',
      target_type: 'rule',
      target_id: 2,
      details: { name: 'SSH Invalid User Login', threshold: 1, severity: 'medium' },
    },
    {
      user_id: null,
      action: 'blocklist.ip_autoblocked',
      target_type: 'ip_blocklist',
      target_id: 1,
      details: { ipAddress: '192.168.1.105', ruleName: 'SSH Brute Force' },
    },
  ];

  for (const e of demoEvents) {
    const nextId = await getNextSequence('audit_log');
    await AuditLogModel.create({
      id: nextId,
      orgId,
      ...e,
    });
  }
}
