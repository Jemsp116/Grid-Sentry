import type { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import * as AlertsModel from '../models/alerts.model.js';
import { getLogById, searchLogs } from '../utils/opensearch.queries.js';

const AlertFilterSchema = z.object({
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['new', 'investigating', 'resolved', 'false_positive']).optional(),
  sourceIp: z.string().optional(),
  mitreId: z.string().optional(),
  logSource: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
});

const UpdateStatusSchema = z.object({
  status: z.enum(['new', 'investigating', 'resolved', 'false_positive']),
  assigned_to: z.number().int().nullable().optional(),
});

const CreateNoteSchema = z.object({
  note: z.string().min(1, 'Note content cannot be empty').max(2000),
});

export async function listAlerts(req: Request, res: Response): Promise<void> {
  const parsed = AlertFilterSchema.safeParse(req.query);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw ApiError.badRequest(`Invalid query parameters: ${issues}`);
  }

  if (!req.user) throw ApiError.unauthorized();
  const orgId = req.user.orgId;

  const result = await AlertsModel.getAlerts({ ...parsed.data, orgId });
  res.status(200).json({ status: 'ok', data: result });
}

export async function getAlert(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id ?? '', 10);
  if (isNaN(id)) throw ApiError.badRequest('Invalid alert ID');
  if (!req.user) throw ApiError.unauthorized();

  const alert = await AlertsModel.getAlertById(id, req.user.orgId);
  if (!alert) throw ApiError.notFound('Alert not found');

  res.status(200).json({ status: 'ok', data: alert });
}

import { logAuditEvent } from '../utils/auditLogger.js';

export async function updateStatus(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id ?? '', 10);
  if (isNaN(id)) throw ApiError.badRequest('Invalid alert ID');
  if (!req.user) throw ApiError.unauthorized();
  const orgId = req.user.orgId;

  const parsed = UpdateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw ApiError.badRequest(`Invalid status update: ${issues}`);
  }

  const existingAlert = await AlertsModel.getAlertById(id, orgId);

  const updated = await AlertsModel.updateAlertStatus(
    id,
    orgId,
    parsed.data.status,
    parsed.data.assigned_to,
  );
  if (!updated) throw ApiError.notFound('Alert not found');

  logAuditEvent({
    userId: req.user.id,
    orgId,
    action: 'alert.status_updated',
    targetType: 'alert',
    targetId: updated.id,
    details: {
      previousStatus: existingAlert?.status,
      newStatus: updated.status,
      assigned_to: updated.assigned_to,
    },
  });

  res.status(200).json({ status: 'ok', data: updated });
}

export async function listNotes(req: Request, res: Response): Promise<void> {
  const alertId = parseInt(req.params.id ?? '', 10);
  if (isNaN(alertId)) throw ApiError.badRequest('Invalid alert ID');
  if (!req.user) throw ApiError.unauthorized();
  const orgId = req.user.orgId;

  const alert = await AlertsModel.getAlertById(alertId, orgId);
  if (!alert) throw ApiError.notFound('Alert not found');

  const notes = await AlertsModel.getAlertNotes(alertId, orgId);
  res.status(200).json({ status: 'ok', data: notes });
}

export async function createNote(req: Request, res: Response): Promise<void> {
  const alertId = parseInt(req.params.id ?? '', 10);
  if (isNaN(alertId)) throw ApiError.badRequest('Invalid alert ID');

  if (!req.user) throw ApiError.unauthorized();
  const userId = req.user.id;
  const orgId = req.user.orgId;

  const alert = await AlertsModel.getAlertById(alertId, orgId);
  if (!alert) throw ApiError.notFound('Alert not found');

  const parsed = CreateNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw ApiError.badRequest(`Invalid note input: ${issues}`);
  }

  const note = await AlertsModel.addAlertNote(alertId, userId, orgId, parsed.data.note);

  logAuditEvent({
    userId,
    orgId,
    action: 'alert.note_added',
    targetType: 'alert',
    targetId: alertId,
  });

  res.status(201).json({ status: 'ok', data: note });
}

export async function getRawLogs(req: Request, res: Response): Promise<void> {
  const alertId = parseInt(req.params.id ?? '', 10);
  if (isNaN(alertId)) throw ApiError.badRequest('Invalid alert ID');
  if (!req.user) throw ApiError.unauthorized();

  const alert = await AlertsModel.getAlertById(alertId, req.user.orgId);
  if (!alert) throw ApiError.notFound('Alert not found');

  const logIds: string[] = Array.isArray(alert.opensearch_log_ids)
    ? alert.opensearch_log_ids
    : [];

  const logs = [];

  // Try retrieving logs by ID
  for (const logId of logIds) {
    if (logId.startsWith('demo-log')) continue; // Skip dummy demo log IDs
    try {
      const doc = await getLogById(logId);
      if (doc) logs.push(doc);
    } catch {
      // Continue retrieving others
    }
  }

  // Fallback: if no docs retrieved by ID (or demo alert), search logs by source_ip
  if (logs.length === 0 && alert.source_ip) {
    try {
      const searchRes = await searchLogs({
        sourceIp: alert.source_ip,
        pageSize: 10,
        page: 1,
      });
      logs.push(...searchRes.hits);
    } catch {
      // Return whatever we have
    }
  }

  res.status(200).json({ status: 'ok', data: logs });
}

import { getThreatIntel } from '../utils/threatIntel.js';

export async function getIpIntel(req: Request, res: Response): Promise<void> {
  const ip = req.params.ip ?? '';
  if (!ip.trim()) throw ApiError.badRequest('IP address parameter is required');

  const intel = await getThreatIntel(ip.trim());
  res.status(200).json({ status: 'ok', data: intel });
}

export function formatAlertsCsv(alerts: any[]): string {
  const headers = ['Alert ID', 'Rule Name', 'Severity', 'Status', 'Source IP', 'Target Host', 'MITRE Technique ID', 'Created At'];
  const rows = alerts.map((a) => [
    String(a.id),
    `"${(a.rule_name || '').replace(/"/g, '""')}"`,
    a.severity || '',
    a.status || '',
    a.source_ip || '',
    `"${(a.target_host || '').replace(/"/g, '""')}"`,
    a.mitre_technique_id || '',
    new Date(a.created_at).toISOString(),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export async function exportAlerts(req: Request, res: Response): Promise<void> {
  if (!req.user) throw ApiError.unauthorized();
  const orgId = req.user.orgId;

  const format = (req.query.format as string) === 'json' ? 'json' : 'csv';
  const filter = {
    orgId,
    severity: (req.query.severity as any) || undefined,
    status: (req.query.status as any) || undefined,
    sourceIp: (req.query.sourceIp as string) || undefined,
    mitreId: (req.query.mitreId as string) || undefined,
    logSource: (req.query.logSource as string) || undefined,
    page: 1,
    pageSize: 10000,
  };

  const result = await AlertsModel.getAlerts(filter);

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="grid-sentry-alerts.json"');
    res.status(200).json({
      exportedAt: new Date().toISOString(),
      totalAlerts: result.alerts.length,
      alerts: result.alerts,
    });
    return;
  }

  const csvContent = formatAlertsCsv(result.alerts);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="grid-sentry-alerts.csv"');
  res.status(200).send(csvContent);
}
