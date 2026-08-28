import type { Request, Response } from 'express';
import { ApiError } from '../utils/ApiError.js';
import {
  CreateRuleSchema,
  UpdateRuleSchema,
  DryRunSchema,
} from '../utils/rules.validator.js';
import * as RulesModel from '../models/rules.model.js';
import { compileRuleToOpenSearchQuery } from '../utils/ruleCompiler.js';
import { opensearch } from '../config/opensearch.js';
import { SOC_LOGS_PATTERN } from '../utils/opensearch.queries.js';

export async function listRules(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id ?? null;
  await RulesModel.seedDefaultRulesIfEmpty(userId);
  const rules = await RulesModel.getRules();
  res.status(200).json({ status: 'ok', data: rules });
}

export async function getRule(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id ?? '', 10);
  if (isNaN(id)) throw ApiError.badRequest('Invalid rule ID');

  const rule = await RulesModel.getRuleById(id);
  if (!rule) throw ApiError.notFound('Rule not found');

  res.status(200).json({ status: 'ok', data: rule });
}

import { logAuditEvent } from '../utils/auditLogger.js';

export async function createRule(req: Request, res: Response): Promise<void> {
  const parsed = CreateRuleSchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw ApiError.badRequest(`Invalid rule input: ${issues}`);
  }

  const userId = req.user?.id ?? null;
  const rule = await RulesModel.createRule(parsed.data, userId);

  logAuditEvent({
    userId,
    action: 'rule.created',
    targetType: 'rule',
    targetId: rule.id,
    details: { name: rule.name, severity: rule.severity, log_source: rule.log_source },
  });

  res.status(201).json({ status: 'ok', data: rule });
}

export async function updateRule(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id ?? '', 10);
  if (isNaN(id)) throw ApiError.badRequest('Invalid rule ID');

  const parsed = UpdateRuleSchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw ApiError.badRequest(`Invalid rule input: ${issues}`);
  }

  const updated = await RulesModel.updateRule(id, parsed.data);
  if (!updated) throw ApiError.notFound('Rule not found');

  logAuditEvent({
    userId: req.user?.id ?? null,
    action: 'rule.updated',
    targetType: 'rule',
    targetId: updated.id,
    details: { name: updated.name, severity: updated.severity },
  });

  res.status(200).json({ status: 'ok', data: updated });
}

export async function toggleRule(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id ?? '', 10);
  if (isNaN(id)) throw ApiError.badRequest('Invalid rule ID');

  const { is_active } = req.body ?? {};
  if (typeof is_active !== 'boolean') {
    throw ApiError.badRequest('is_active boolean property is required');
  }

  const updated = await RulesModel.toggleRuleActive(id, is_active);
  if (!updated) throw ApiError.notFound('Rule not found');

  logAuditEvent({
    userId: req.user?.id ?? null,
    action: 'rule.toggled',
    targetType: 'rule',
    targetId: updated.id,
    details: { name: updated.name, is_active: updated.is_active },
  });

  res.status(200).json({ status: 'ok', data: updated });
}

export async function deleteRule(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id ?? '', 10);
  if (isNaN(id)) throw ApiError.badRequest('Invalid rule ID');

  const deleted = await RulesModel.deleteRule(id);
  if (!deleted) throw ApiError.notFound('Rule not found');

  logAuditEvent({
    userId: req.user?.id ?? null,
    action: 'rule.deleted',
    targetType: 'rule',
    targetId: id,
  });

  res.status(200).json({ status: 'ok', message: 'Rule deleted successfully' });
}

export async function dryRunRule(req: Request, res: Response): Promise<void> {
  const parsed = DryRunSchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw ApiError.badRequest(`Invalid dry-run parameters: ${issues}`);
  }

  const { log_source, match_conditions, lookback_hours } = parsed.data;
  const fromIso = new Date(Date.now() - lookback_hours * 3600 * 1000).toISOString();
  const queryBody = compileRuleToOpenSearchQuery(match_conditions, log_source, fromIso);

  try {
    const { body } = await opensearch.search({
      index: SOC_LOGS_PATTERN,
      body: {
        ...queryBody,
        size: 10, // return up to 10 sample matching hits
        sort: [{ '@timestamp': { order: 'desc' } }],
      },
    });

    const resp = body as any;
    const hitsObj = resp.hits ?? {};
    const totalRaw = hitsObj.total;
    const totalCount: number = typeof totalRaw === 'number' ? totalRaw : totalRaw?.value ?? 0;

    const sampleHits = (hitsObj.hits ?? []).map((h: any) => ({
      _id: h._id as string,
      _index: h._index as string,
      _source: h._source as Record<string, unknown>,
    }));

    res.status(200).json({
      status: 'ok',
      data: {
        matchedCount: totalCount,
        lookbackHours: lookback_hours,
        sampleHits,
      },
    });
  } catch (err: any) {
    if (err?.meta?.statusCode === 404) {
      res.status(200).json({
        status: 'ok',
        data: { matchedCount: 0, lookbackHours: lookback_hours, sampleHits: [] },
      });
      return;
    }
    throw err;
  }
}
