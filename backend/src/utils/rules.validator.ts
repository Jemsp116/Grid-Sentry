import { z } from 'zod';

/**
 * Constrained DSL Whitelists (TICKET-005).
 * Only allowed log sources, fields, and operators can be used in rules.
 * No free-text code, arbitrary regex, or unvalidated queries are permitted.
 */

export const ALLOWED_LOG_SOURCES = ['ssh_auth'] as const;

export const ALLOWED_RULE_FIELDS = [
  'event_type',
  'outcome',
  'source_ip',
  'ssh_user',
  'raw_message',
] as const;

export const ALLOWED_RULE_OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'exists',
] as const;

export type AllowedLogSource = (typeof ALLOWED_LOG_SOURCES)[number];
export type AllowedRuleField = (typeof ALLOWED_RULE_FIELDS)[number];
export type AllowedRuleOperator = (typeof ALLOWED_RULE_OPERATORS)[number];

export const MatchConditionSchema = z.object({
  field: z.enum(ALLOWED_RULE_FIELDS),
  operator: z.enum(ALLOWED_RULE_OPERATORS),
  value: z.string().optional().default(''),
}).refine((cond) => {
  if (cond.operator !== 'exists' && (!cond.value || cond.value.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: 'Value is required for operators other than "exists"',
  path: ['value'],
});

export type MatchCondition = z.infer<typeof MatchConditionSchema>;

export const CreateRuleSchema = z.object({
  name: z.string().min(2, 'Rule name must be at least 2 characters').max(100),
  description: z.string().max(500).optional(),
  log_source: z.enum(ALLOWED_LOG_SOURCES),
  match_conditions: z
    .array(MatchConditionSchema)
    .min(1, 'Rule must contain at least one match condition'),
  threshold: z.number().int().min(1, 'Threshold must be at least 1').default(1),
  time_window_seconds: z
    .number()
    .int()
    .min(1, 'Time window must be at least 1 second')
    .max(86400, 'Time window cannot exceed 24 hours')
    .default(60),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  mitre_technique_id: z
    .string()
    .regex(/^T\d{4}(\.\d{3})?$/, 'MITRE Technique ID must be in format T1110 or T1078.001')
    .optional()
    .nullable(),
  action_on_trigger: z.enum(['alert_only', 'alert_and_block_ip']).default('alert_only'),
  is_active: z.boolean().default(true),
});

export const UpdateRuleSchema = CreateRuleSchema.partial();

export const DryRunSchema = z.object({
  log_source: z.enum(ALLOWED_LOG_SOURCES),
  match_conditions: z.array(MatchConditionSchema).min(1),
  lookback_hours: z.number().int().min(1).max(720).default(24), // up to 30 days
});

export type CreateRuleInput = z.infer<typeof CreateRuleSchema>;
export type UpdateRuleInput = z.infer<typeof UpdateRuleSchema>;
export type DryRunInput = z.infer<typeof DryRunSchema>;
