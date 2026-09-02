import type { SeverityLevel } from './rules.model.js';
import { seedDefaultRulesIfEmpty, getRules } from './rules.model.js';
import {
  AlertModel,
  AlertNoteModel,
  RuleModel,
  UserModel,
  getNextSequence,
  type IAlertDoc,
  type IAlertNoteDoc,
  type IRuleDoc,
} from '../config/mongoSchemas.js';
import { loadRules, loadUserEmails } from './lookups.js';

export type AlertStatus = 'new' | 'investigating' | 'resolved' | 'false_positive';

export interface AlertRow {
  id: number;
  rule_id: number;
  source_ip: string;
  target_host: string | null;
  severity: SeverityLevel;
  status: AlertStatus;
  opensearch_log_ids: string[];
  assigned_to: number | null;
  created_at: Date;
}

export interface AlertWithMetadata extends AlertRow {
  rule_name: string;
  rule_description: string | null;
  log_source: string;
  match_conditions: unknown;
  threshold: number;
  time_window_seconds: number;
  action_on_trigger: string;
  mitre_technique_id: string | null;
  assigned_to_email: string | null;
}

export interface AlertNoteRow {
  id: number;
  alert_id: number;
  user_id: number;
  user_email: string;
  note: string;
  created_at: Date;
}

export interface AlertFilterParams {
  severity?: SeverityLevel;
  status?: AlertStatus;
  sourceIp?: string;
  mitreId?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Builds the enriched alert row from a doc plus pre-loaded rule/user maps.
 * Synchronous by design — callers batch the lookups once per page via
 * `loadRules` / `loadUserEmails` rather than querying per row.
 */
function enrichAlertDoc(
  doc: IAlertDoc,
  rules: Map<number, IRuleDoc>,
  userEmails: Map<number, string>,
): AlertWithMetadata {
  const rule = rules.get(doc.rule_id);

  return {
    id: doc.id,
    rule_id: doc.rule_id,
    source_ip: doc.source_ip,
    target_host: doc.target_host ?? null,
    severity: doc.severity,
    status: doc.status,
    opensearch_log_ids: doc.opensearch_log_ids || [],
    assigned_to: doc.assigned_to ?? null,
    created_at: doc.created_at,
    rule_name: rule?.name || 'Unknown Rule',
    rule_description: rule?.description ?? null,
    log_source: rule?.log_source || 'ssh_auth',
    match_conditions: rule?.match_conditions || [],
    threshold: rule?.threshold || 1,
    time_window_seconds: rule?.time_window_seconds || 60,
    action_on_trigger: rule?.action_on_trigger || 'alert_only',
    mitre_technique_id: rule?.mitre_technique_id ?? null,
    assigned_to_email: doc.assigned_to ? userEmails.get(doc.assigned_to) ?? null : null,
  };
}

/** Enriches a single alert doc, batching its two lookups. */
async function enrichOne(doc: IAlertDoc): Promise<AlertWithMetadata> {
  const [rules, userEmails] = await Promise.all([
    loadRules([doc.rule_id]),
    loadUserEmails([doc.assigned_to]),
  ]);
  return enrichAlertDoc(doc, rules, userEmails);
}

export async function getAlerts(params: AlertFilterParams = {}): Promise<{
  alerts: AlertWithMetadata[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const { severity, status, sourceIp, mitreId, page = 1, pageSize = 50 } = params;

  const queryFilter: any = {};
  if (severity) queryFilter.severity = severity;
  if (status) queryFilter.status = status;
  if (sourceIp) queryFilter.source_ip = { $regex: sourceIp, $options: 'i' };

  if (mitreId) {
    const matchingRules = await RuleModel.find({ mitre_technique_id: mitreId }, { id: 1 });
    const ruleIds = matchingRules.map((r) => r.id);
    queryFilter.rule_id = { $in: ruleIds };
  }

  const total = await AlertModel.countDocuments(queryFilter);
  const skip = (page - 1) * pageSize;

  const docs = await AlertModel.find(queryFilter)
    .sort({ created_at: -1, id: -1 })
    .skip(skip)
    .limit(pageSize);

  const [rules, userEmails] = await Promise.all([
    loadRules(docs.map((d) => d.rule_id)),
    loadUserEmails(docs.map((d) => d.assigned_to)),
  ]);
  const enrichedAlerts = docs.map((d) => enrichAlertDoc(d, rules, userEmails));

  return {
    alerts: enrichedAlerts,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

export async function getAlertById(id: number): Promise<AlertWithMetadata | null> {
  const doc = await AlertModel.findOne({ id });
  return doc ? await enrichOne(doc) : null;
}

export async function updateAlertStatus(
  id: number,
  status: AlertStatus,
  assignedTo?: number | null,
): Promise<AlertWithMetadata | null> {
  const updateFields: any = { status };
  if (assignedTo !== undefined) updateFields.assigned_to = assignedTo;

  const doc = await AlertModel.findOneAndUpdate({ id }, updateFields, { new: true });
  return doc ? await enrichOne(doc) : null;
}

export async function getAlertNotes(alertId: number): Promise<AlertNoteRow[]> {
  const noteDocs = await AlertNoteModel.find({ alert_id: alertId }).sort({ created_at: 1 });
  const userEmails = await loadUserEmails(noteDocs.map((n) => n.user_id));

  return noteDocs.map((n: IAlertNoteDoc) => ({
    id: n.id,
    alert_id: n.alert_id,
    user_id: n.user_id,
    user_email: userEmails.get(n.user_id) || 'Unknown User',
    note: n.note,
    created_at: n.created_at,
  }));
}

export async function addAlertNote(
  alertId: number,
  userId: number,
  note: string,
): Promise<AlertNoteRow> {
  const nextId = await getNextSequence('alert_notes');
  const doc = await AlertNoteModel.create({
    id: nextId,
    alert_id: alertId,
    user_id: userId,
    note,
  });

  const user = await UserModel.findOne({ id: userId });

  return {
    id: doc.id,
    alert_id: doc.alert_id,
    user_id: doc.user_id,
    user_email: user?.email || 'Unknown User',
    note: doc.note,
    created_at: doc.created_at,
  };
}

export async function seedDemoAlertsIfEmpty(userId: number | null): Promise<void> {
  const count = await AlertModel.countDocuments();
  if (count > 0) return;

  await seedDefaultRulesIfEmpty(userId);
  const rules = await getRules();
  if (rules.length === 0) return;

  const bruteForceRule = rules.find((r) => r.mitre_technique_id === 'T1110') ?? rules[0]!;
  const invalidUserRule = rules.find((r) => r.mitre_technique_id === 'T1078') ?? rules[0]!;

  const demoAlerts = [
    {
      rule_id: bruteForceRule.id,
      source_ip: '192.168.1.105',
      target_host: 'soc_ssh_target',
      severity: bruteForceRule.severity,
      status: 'new' as AlertStatus,
      opensearch_log_ids: ['demo-log-1', 'demo-log-2'],
      assigned_to: userId,
    },
    {
      rule_id: invalidUserRule.id,
      source_ip: '10.0.0.42',
      target_host: 'soc_ssh_target',
      severity: invalidUserRule.severity,
      status: 'investigating' as AlertStatus,
      opensearch_log_ids: ['demo-log-3'],
      assigned_to: userId,
    },
  ];

  for (const alert of demoAlerts) {
    const nextId = await getNextSequence('alerts');
    await AlertModel.create({
      id: nextId,
      ...alert,
    });
  }
}
