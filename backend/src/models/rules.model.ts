import type { CreateRuleInput, UpdateRuleInput, MatchCondition } from '../utils/rules.validator.js';
import { RuleModel, getNextSequence, type IRuleDoc } from '../config/mongoSchemas.js';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type RuleAction = 'alert_only' | 'alert_and_block_ip';

export interface RuleRow {
  id: number;
  name: string;
  description: string | null;
  log_source: string;
  match_conditions: MatchCondition[];
  threshold: number;
  time_window_seconds: number;
  severity: SeverityLevel;
  mitre_technique_id: string | null;
  action_on_trigger: RuleAction;
  is_active: boolean;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

function docToRuleRow(doc: IRuleDoc): RuleRow {
  return {
    id: doc.id,
    name: doc.name,
    description: doc.description ?? null,
    log_source: doc.log_source,
    match_conditions: (doc.match_conditions as any) || [],
    threshold: doc.threshold,
    time_window_seconds: doc.time_window_seconds,
    severity: doc.severity,
    mitre_technique_id: doc.mitre_technique_id ?? null,
    action_on_trigger: doc.action_on_trigger,
    is_active: doc.is_active,
    created_by: doc.created_by ?? null,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

export async function getRules(): Promise<RuleRow[]> {
  const docs = await RuleModel.find().sort({ id: -1 });
  return docs.map(docToRuleRow);
}

export async function getActiveRules(): Promise<RuleRow[]> {
  const docs = await RuleModel.find({ is_active: true }).sort({ id: 1 });
  return docs.map(docToRuleRow);
}

export async function getRuleById(id: number): Promise<RuleRow | null> {
  const doc = await RuleModel.findOne({ id });
  return doc ? docToRuleRow(doc) : null;
}

export async function createRule(
  input: CreateRuleInput,
  userId: number | null,
): Promise<RuleRow> {
  const nextId = await getNextSequence('rules');
  const doc = await RuleModel.create({
    id: nextId,
    name: input.name,
    description: input.description ?? null,
    log_source: input.log_source,
    match_conditions: input.match_conditions as any,
    threshold: input.threshold,
    time_window_seconds: input.time_window_seconds,
    severity: input.severity,
    mitre_technique_id: input.mitre_technique_id ?? null,
    action_on_trigger: input.action_on_trigger,
    is_active: input.is_active,
    created_by: userId,
  });
  return docToRuleRow(doc);
}

export async function updateRule(
  id: number,
  input: UpdateRuleInput,
): Promise<RuleRow | null> {
  const updateFields: any = { updated_at: new Date() };

  if (input.name !== undefined) updateFields.name = input.name;
  if (input.description !== undefined) updateFields.description = input.description;
  if (input.log_source !== undefined) updateFields.log_source = input.log_source;
  if (input.match_conditions !== undefined) updateFields.match_conditions = input.match_conditions;
  if (input.threshold !== undefined) updateFields.threshold = input.threshold;
  if (input.time_window_seconds !== undefined) updateFields.time_window_seconds = input.time_window_seconds;
  if (input.severity !== undefined) updateFields.severity = input.severity;
  if (input.mitre_technique_id !== undefined) updateFields.mitre_technique_id = input.mitre_technique_id;
  if (input.action_on_trigger !== undefined) updateFields.action_on_trigger = input.action_on_trigger;
  if (input.is_active !== undefined) updateFields.is_active = input.is_active;

  const doc = await RuleModel.findOneAndUpdate({ id }, updateFields, { new: true });
  return doc ? docToRuleRow(doc) : null;
}

export async function toggleRuleActive(id: number, isActive: boolean): Promise<RuleRow | null> {
  const doc = await RuleModel.findOneAndUpdate({ id }, { is_active: isActive, updated_at: new Date() }, { new: true });
  return doc ? docToRuleRow(doc) : null;
}

export async function deleteRule(id: number): Promise<boolean> {
  const res = await RuleModel.deleteOne({ id });
  return res.deletedCount > 0;
}

export async function seedDefaultRulesIfEmpty(userId: number | null): Promise<void> {
  const count = await RuleModel.countDocuments();
  if (count > 0) return;

  const defaultRules: CreateRuleInput[] = [
    {
      name: 'SSH Brute Force',
      description: 'Flags repeated failed SSH login attempts from the same source IP within a 60s window and auto-blocks the IP.',
      log_source: 'ssh_auth',
      match_conditions: [
        { field: 'event_type', operator: 'equals', value: 'auth' },
        { field: 'raw_message', operator: 'contains', value: 'Failed password' },
      ],
      threshold: 5,
      time_window_seconds: 60,
      severity: 'high',
      mitre_technique_id: 'T1110',
      action_on_trigger: 'alert_and_block_ip',
      is_active: true,
    },
    {
      name: 'SSH Invalid User Login',
      description: 'Flags SSH authentication attempts targeting invalid usernames.',
      log_source: 'ssh_auth',
      match_conditions: [
        { field: 'event_type', operator: 'equals', value: 'auth' },
        { field: 'raw_message', operator: 'contains', value: 'Invalid user' },
      ],
      threshold: 1,
      time_window_seconds: 60,
      severity: 'medium',
      mitre_technique_id: 'T1078',
      action_on_trigger: 'alert_only',
      is_active: true,
    },
  ];

  for (const rule of defaultRules) {
    await createRule(rule, userId);
  }
}
