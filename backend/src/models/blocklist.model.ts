import {
  IPBlocklistModel,
  RuleModel,
  UserModel,
  getNextSequence,
  type IIPBlocklistDoc,
} from '../config/mongoSchemas.js';

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

async function docToMetadata(doc: IIPBlocklistDoc): Promise<BlocklistWithMetadata> {
  const rule = doc.triggered_by_rule_id ? await RuleModel.findOne({ id: doc.triggered_by_rule_id }) : null;
  const user = doc.added_by ? await UserModel.findOne({ id: doc.added_by }) : null;

  return {
    id: doc.id,
    ip_address: doc.ip_address,
    reason: doc.reason ?? null,
    triggered_by_rule_id: doc.triggered_by_rule_id ?? null,
    added_by: doc.added_by ?? null,
    expires_at: doc.expires_at ?? null,
    created_at: doc.created_at,
    rule_name: rule?.name ?? null,
    added_by_email: user?.email ?? null,
    type: doc.triggered_by_rule_id ? 'rule' : 'manual',
  };
}

export async function getBlocklist(): Promise<BlocklistWithMetadata[]> {
  const docs = await IPBlocklistModel.find().sort({ created_at: -1 });
  return await Promise.all(docs.map(docToMetadata));
}

export async function findByIp(ipAddress: string): Promise<BlocklistRow | null> {
  const doc = await IPBlocklistModel.findOne({ ip_address: ipAddress.trim() });
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
  ipAddress: string,
  reason: string | null,
  addedBy: number | null,
  expiresAt?: string | null,
): Promise<{ entry: BlocklistWithMetadata; alreadyBlocked: boolean }> {
  const cleanIp = ipAddress.trim();
  const existingDoc = await IPBlocklistModel.findOne({ ip_address: cleanIp });
  if (existingDoc) {
    const entry = await docToMetadata(existingDoc);
    return { entry, alreadyBlocked: true };
  }

  const nextId = await getNextSequence('ip_blocklist');
  const doc = await IPBlocklistModel.create({
    id: nextId,
    ip_address: cleanIp,
    reason: reason ?? null,
    added_by: addedBy ?? null,
    expires_at: expiresAt ? new Date(expiresAt) : null,
  });

  const entry = await docToMetadata(doc);
  return { entry, alreadyBlocked: false };
}

export async function removeBlocklistIp(id: number): Promise<boolean> {
  const res = await IPBlocklistModel.deleteOne({ id });
  return res.deletedCount > 0;
}
