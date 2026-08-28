/**
 * Rules API Client (TICKET-005).
 * Typed fetch wrappers using authFetch from AuthContext.
 */

export interface MatchCondition {
  field: 'event_type' | 'outcome' | 'source_ip' | 'ssh_user' | 'raw_message';
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'exists';
  value?: string;
}

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type RuleAction = 'alert_only' | 'alert_and_block_ip';

export interface Rule {
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
  created_at: string;
  updated_at: string;
}

export interface CreateRuleInput {
  name: string;
  description?: string;
  log_source: string;
  match_conditions: MatchCondition[];
  threshold: number;
  time_window_seconds: number;
  severity: SeverityLevel;
  mitre_technique_id?: string | null;
  action_on_trigger: RuleAction;
  is_active?: boolean;
}

export type UpdateRuleInput = Partial<CreateRuleInput>;

export interface DryRunInput {
  log_source: string;
  match_conditions: MatchCondition[];
  lookback_hours?: number;
}

export interface DryRunResult {
  matchedCount: number;
  lookbackHours: number;
  sampleHits: Array<{
    _id: string;
    _index: string;
    _source: Record<string, unknown>;
  }>;
}

type AuthFetch = (path: string, init?: RequestInit) => Promise<Response>;

export async function fetchRules(authFetch: AuthFetch): Promise<Rule[]> {
  const res = await authFetch('/rules');
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to fetch rules (${res.status})`);
  }
  const data = (await res.json()) as { data: Rule[] };
  return data.data;
}

export async function fetchRuleById(authFetch: AuthFetch, id: number): Promise<Rule> {
  const res = await authFetch(`/rules/${id}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to fetch rule (${res.status})`);
  }
  const data = (await res.json()) as { data: Rule };
  return data.data;
}

export async function createRule(authFetch: AuthFetch, input: CreateRuleInput): Promise<Rule> {
  const res = await authFetch('/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to create rule (${res.status})`);
  }
  const data = (await res.json()) as { data: Rule };
  return data.data;
}

export async function updateRule(
  authFetch: AuthFetch,
  id: number,
  input: UpdateRuleInput,
): Promise<Rule> {
  const res = await authFetch(`/rules/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to update rule (${res.status})`);
  }
  const data = (await res.json()) as { data: Rule };
  return data.data;
}

export async function toggleRule(
  authFetch: AuthFetch,
  id: number,
  isActive: boolean,
): Promise<Rule> {
  const res = await authFetch(`/rules/${id}/toggle`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active: isActive }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to toggle rule active state (${res.status})`);
  }
  const data = (await res.json()) as { data: Rule };
  return data.data;
}

export async function deleteRule(authFetch: AuthFetch, id: number): Promise<void> {
  const res = await authFetch(`/rules/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to delete rule (${res.status})`);
  }
}

export async function dryRunRule(authFetch: AuthFetch, input: DryRunInput): Promise<DryRunResult> {
  const res = await authFetch('/rules/dry-run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Dry run failed (${res.status})`);
  }
  const data = (await res.json()) as { data: DryRunResult };
  return data.data;
}
