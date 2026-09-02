import {
  WorkerRuleModel,
  WorkerAlertModel,
  WorkerBlocklistModel,
  WorkerAuditLogModel,
  getNextSequence,
} from './db.js';
import { opensearch, SOC_LOGS_PATTERN } from './opensearch.js';
import { compileRuleToOpenSearchQuery, type MatchCondition } from './ruleCompiler.js';

export interface ActiveRule {
  id: number;
  name: string;
  description: string | null;
  log_source: string;
  match_conditions: MatchCondition[];
  threshold: number;
  time_window_seconds: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mitre_technique_id: string | null;
  action_on_trigger: 'alert_only' | 'alert_and_block_ip';
  is_active: boolean;
}

function log(msg: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), svc: 'worker', msg, ...meta }));
}

export async function getActiveRules(): Promise<ActiveRule[]> {
  const docs = await WorkerRuleModel.find({ is_active: true }).sort({ id: 1 });
  return docs.map((d: any) => ({
    id: d.id,
    name: d.name,
    description: d.description ?? null,
    log_source: d.log_source,
    match_conditions: d.match_conditions || [],
    threshold: d.threshold,
    time_window_seconds: d.time_window_seconds,
    severity: d.severity,
    mitre_technique_id: d.mitre_technique_id ?? null,
    action_on_trigger: d.action_on_trigger,
    is_active: d.is_active,
  }));
}

export async function evaluateRulesOnce(): Promise<number> {
  let alertsCreated = 0;
  const activeRules = await getActiveRules();

  if (activeRules.length === 0) {
    return 0;
  }

  for (const rule of activeRules) {
    try {
      const created = await evaluateSingleRule(rule);
      alertsCreated += created;
    } catch (err: any) {
      if (err?.meta?.statusCode === 404) {
        continue;
      }
      log('error evaluating rule', {
        ruleId: rule.id,
        ruleName: rule.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return alertsCreated;
}

async function evaluateSingleRule(rule: ActiveRule): Promise<number> {
  const now = new Date();
  const fromIso = new Date(now.getTime() - rule.time_window_seconds * 1000).toISOString();
  const queryBody = compileRuleToOpenSearchQuery(rule.match_conditions, rule.log_source, fromIso);

  const { body } = await opensearch.search({
    index: SOC_LOGS_PATTERN,
    body: {
      ...queryBody,
      size: 100,
      aggs: {
        by_ip: {
          terms: { field: 'source_ip', size: 100 },
        },
      },
    },
  });

  const resp = body as any;
  const aggs = resp.aggregations ?? {};
  const buckets: Array<{ key: string; doc_count: number }> = aggs.by_ip?.buckets ?? [];

  let alertsCreated = 0;

  for (const bucket of buckets) {
    if (bucket.doc_count >= rule.threshold) {
      const sourceIp = bucket.key;
      if (!sourceIp || sourceIp === 'unknown') continue;

      const windowDate = new Date(Date.now() - rule.time_window_seconds * 1000);
      const existingAlert = await WorkerAlertModel.findOne({
        rule_id: rule.id,
        source_ip: sourceIp,
        created_at: { $gte: windowDate },
      });

      if (existingAlert) {
        continue;
      }

      const hits = (resp.hits?.hits ?? []).filter((h: any) => h._source?.source_ip === sourceIp);
      const logIds = hits.map((h: any) => h._id as string);
      const targetHost = hits[0]?._source?.host as string | undefined;

      const nextAlertId = await getNextSequence('alerts');
      const alertDoc = await WorkerAlertModel.create({
        id: nextAlertId,
        rule_id: rule.id,
        source_ip: sourceIp,
        target_host: targetHost ?? null,
        severity: rule.severity,
        status: 'new',
        opensearch_log_ids: logIds,
      });

      const alertId = alertDoc.id;
      alertsCreated++;

      log('ALERT TRIGGERED', {
        alertId,
        ruleId: rule.id,
        ruleName: rule.name,
        sourceIp,
        matchCount: bucket.doc_count,
        severity: rule.severity,
        action: rule.action_on_trigger,
      });

      if (rule.action_on_trigger === 'alert_and_block_ip') {
        let blockDoc = await WorkerBlocklistModel.findOne({ ip_address: sourceIp });
        if (blockDoc) {
          blockDoc.reason = `Auto-blocked by rule: ${rule.name}`;
          blockDoc.triggered_by_rule_id = rule.id;
          await blockDoc.save();
        } else {
          const nextBlockId = await getNextSequence('ip_blocklist');
          blockDoc = await WorkerBlocklistModel.create({
            id: nextBlockId,
            ip_address: sourceIp,
            reason: `Auto-blocked by rule: ${rule.name}`,
            triggered_by_rule_id: rule.id,
          });
        }

        const nextAuditId = await getNextSequence('audit_log');
        await WorkerAuditLogModel.create({
          id: nextAuditId,
          user_id: null,
          action: 'blocklist.ip_autoblocked',
          target_type: 'ip_blocklist',
          target_id: blockDoc.id,
          details: {
            ipAddress: sourceIp,
            ruleId: rule.id,
            ruleName: rule.name,
            alertId,
          },
        });
      }
    }
  }

  return alertsCreated;
}
