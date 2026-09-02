import { MITRE_TACTICS } from '../utils/mitreCatalog.js';
import { AlertModel, RuleModel } from '../config/mongoSchemas.js';

export interface MitreTechniqueHit {
  id: string;
  name: string;
  tacticId: string;
  tacticName: string;
  description: string;
  alertCount: number;
  maxSeverity: string | null;
  intensity: number;
}

export interface MitreTacticMatrixItem {
  id: string;
  name: string;
  description: string;
  totalAlerts: number;
  techniques: MitreTechniqueHit[];
}

export interface MitreMatrixResponse {
  lookbackHours: number;
  totalDetections: number;
  tactics: MitreTacticMatrixItem[];
}

export async function getMitreMatrix(lookbackHours = 24, orgId?: string): Promise<MitreMatrixResponse> {
  const sinceDate = new Date(Date.now() - lookbackHours * 3600 * 1000);
  const filter: Record<string, any> = {
    created_at: { $gte: sinceDate },
    ...(orgId ? { orgId } : {}),
  };

  const [alerts, rules] = await Promise.all([
    AlertModel.find(filter).lean(),
    RuleModel.find(orgId ? { orgId } : {}).lean(),
  ]);

  const ruleMap = new Map(rules.map((r) => [r.id, r]));

  const hitMap = new Map<string, { count: number; maxSeverity: string }>();
  let maxCount = 1;
  let totalDetections = 0;

  for (const alert of alerts) {
    const rule = ruleMap.get(alert.rule_id);
    const techId = (rule?.mitre_technique_id || 'UNKNOWN').toUpperCase();

    const existing = hitMap.get(techId) || { count: 0, maxSeverity: 'low' };
    existing.count += 1;

    // Severity rank check
    const currentRank = alert.severity === 'critical' ? 4 : alert.severity === 'high' ? 3 : alert.severity === 'medium' ? 2 : 1;
    const existingRank = existing.maxSeverity === 'critical' ? 4 : existing.maxSeverity === 'high' ? 3 : existing.maxSeverity === 'medium' ? 2 : 1;
    if (currentRank > existingRank) {
      existing.maxSeverity = alert.severity;
    }

    hitMap.set(techId, existing);
    totalDetections += 1;
    if (existing.count > maxCount) maxCount = existing.count;
  }

  const tactics: MitreTacticMatrixItem[] = MITRE_TACTICS.map((tactic) => {
    let tacticAlerts = 0;
    const techniques: MitreTechniqueHit[] = tactic.techniques.map((tech) => {
      const hitData = hitMap.get(tech.id.toUpperCase());
      const alertCount = hitData?.count ?? 0;
      tacticAlerts += alertCount;

      const intensity = alertCount > 0 ? Math.min(100, Math.round((alertCount / maxCount) * 100)) : 0;

      return {
        id: tech.id,
        name: tech.name,
        tacticId: tech.tacticId,
        tacticName: tech.tacticName,
        description: tech.description,
        alertCount,
        maxSeverity: hitData?.maxSeverity ?? null,
        intensity,
      };
    });

    return {
      id: tactic.id,
      name: tactic.name,
      description: tactic.description,
      totalAlerts: tacticAlerts,
      techniques,
    };
  });

  return {
    lookbackHours,
    totalDetections,
    tactics,
  };
}
