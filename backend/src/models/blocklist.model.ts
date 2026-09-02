import {
  IPBlocklistModel,
  getNextSequence,
  type IIPBlocklistDoc,
  type IRuleDoc,
} from '../config/mongoSchemas.js';
import { loadRules, loadUserEmails } from './lookups.js';

export interface BlocklistRow {
  id: number;
  ip_address: string;
  reason: string | null;
  triggered_by_rule_id: number | null;
  added_by: number | null;
  expires_at: Date | null;
  created_at: Date;
}

export interface BlocklistWithMetadata extends BlocklistRow {
  rule_name: string | null;
  added_by_email: string | null;
  type: 'manual' | 'rule';
}

/**
 * Builds an enriched blocklist row from pre-loaded rule/user maps. Synchronous
 * by design — see `models/lookups.ts`.
 */
function docToMetadata(
  doc: IIPBlocklistDoc,
  rules: Map<number, IRuleDoc>,
  userEmails: Map<number, string>,
): BlocklistWithMetadata {
  return {
    id: doc.id,
    ip_address: doc.ip_address,
    reason: doc.reason ?? null,
    triggered_by_rule_id: doc.triggered_by_rule_id ?? null,
    added_by: doc.added_by ?? null,
    expires_at: doc.expires_at ?? null,
    created_at: doc.created_at,
    rule_name: doc.triggered_by_rule_id
      ? rules.get(doc.triggered_by_rule_id)?.name ?? null
      : null,
    added_by_email: doc.added_by ? userEmails.get(doc.added_by) ?? null : null,
    type: doc.triggered_by_rule_id ? 'rule' : 'manual',
  };
}

/** Enriches a single blocklist doc, batching its two lookups. */
async function enrichOne(doc: IIPBlocklistDoc): Promise<BlocklistWithMetadata> {
  const [rules, userEmails] = await Promise.all([
    loadRules([doc.triggered_by_rule_id]),
    loadUserEmails([doc.added_by]),
  ]);
  return docToMetadata(doc, rules, userEmails);
}

export async function getBlocklist(orgId: string): Promise<BlocklistWithMetadata[]> {
  const docs = await IPBlocklistModel.find({ orgId }).sort({ created_at: -1 });
  const [rules, userEmails] = await Promise.all([
    loadRules(docs.map((d) => d.triggered_by_rule_id)),
    loadUserEmails(docs.map((d) => d.added_by)),
  ]);
  return docs.map((d) => docToMetadata(d, rules, userEmails));
}

export async function findByIp(orgId: string, ipAddress: string): Promise<BlocklistRow | null> {
  const doc = await IPBlocklistModel.findOne({ orgId, ip_address: ipAddress.trim() });
  if (!doc) return null;
  return {
    id: doc.id,
    ip_address: doc.ip_address,
    reason: doc.reason ?? null,
    triggered_by_rule_id: doc.triggered_by_rule_id ?? null,
    added_by: doc.added_by ?? null,
    expires_at: doc.expires_at ?? null,
    created_at: doc.created_at,
  };
}

export async function addBlocklistIp(
  orgId: string,
  ipAddress: string,
  reason: string | null,
  addedBy: number | null,
  expiresAt?: string | null,
): Promise<{ entry: BlocklistWithMetadata; alreadyBlocked: boolean }> {
  const cleanIp = ipAddress.trim();
  const existingDoc = await IPBlocklistModel.findOne({ orgId, ip_address: cleanIp });
  if (existingDoc) {
    const entry = await enrichOne(existingDoc);
    return { entry, alreadyBlocked: true };
  }

  const nextId = await getNextSequence('ip_blocklist');
  const doc = await IPBlocklistModel.create({
    id: nextId,
    orgId,
    ip_address: cleanIp,
    reason: reason ?? null,
    added_by: addedBy ?? null,
    expires_at: expiresAt ? new Date(expiresAt) : null,
  });

  const entry = await enrichOne(doc);
  return { entry, alreadyBlocked: false };
}

export async function removeBlocklistIp(id: number, orgId: string): Promise<boolean> {
  const res = await IPBlocklistModel.deleteOne({ id, orgId });
  return res.deletedCount > 0;
}
