import crypto from 'node:crypto';
import { ApiKeyModel, getNextSequence, type IApiKeyDoc } from '../config/mongoSchemas.js';

export interface ApiKeyRow {
  id: number;
  orgId: string;
  app_name: string;
  is_active: boolean;
  connection_method: 'code' | 'agent';
  created_by: number;
  first_event_at: Date | null;
  last_used_at: Date | null;
  event_count: number;
  created_at: Date;
}

export interface CreatedApiKeyResult extends ApiKeyRow {
  raw_key: string;
}

export interface ApiKeyStatusResult {
  id: number;
  app_name: string;
  is_active: boolean;
  connection_method: 'code' | 'agent';
  is_connected: boolean;
  first_event_at: Date | null;
  last_used_at: Date | null;
  event_count: number;
}

function docToRow(doc: IApiKeyDoc): ApiKeyRow {
  return {
    id: doc.id,
    orgId: doc.orgId ? doc.orgId.toString() : '',
    app_name: doc.app_name,
    is_active: doc.is_active,
    connection_method: doc.connection_method || 'code',
    created_by: doc.created_by,
    first_event_at: doc.first_event_at ?? null,
    last_used_at: doc.last_used_at ?? null,
    event_count: doc.event_count ?? 0,
    created_at: doc.created_at,
  };
}

export function generateRawApiKey(): string {
  return `gs_live_${crypto.randomBytes(24).toString('hex')}`;
}

export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
}

export async function createApiKey(
  orgId: string,
  appName: string,
  createdBy: number,
  connectionMethod: 'code' | 'agent' = 'code',
): Promise<CreatedApiKeyResult> {
  const rawKey = generateRawApiKey();
  const keyHash = hashApiKey(rawKey);
  const nextId = await getNextSequence('api_keys');

  const doc = await ApiKeyModel.create({
    id: nextId,
    orgId,
    app_name: appName.trim(),
    key_hash: keyHash,
    is_active: true,
    connection_method: connectionMethod,
    created_by: createdBy,
    first_event_at: null,
    last_used_at: null,
    event_count: 0,
    created_at: new Date(),
  });

  return {
    ...docToRow(doc),
    raw_key: rawKey,
  };
}

export async function listApiKeys(orgId: string): Promise<ApiKeyRow[]> {
  const docs = await ApiKeyModel.find({ orgId }).sort({ created_at: -1 });
  return docs.map(docToRow);
}

export async function findActiveApiKeyByHash(keyHash: string): Promise<ApiKeyRow | null> {
  const doc = await ApiKeyModel.findOne({ key_hash: keyHash, is_active: true });
  if (!doc) return null;
  return docToRow(doc);
}

export async function findApiKeyById(id: number, orgId: string): Promise<ApiKeyRow | null> {
  const doc = await ApiKeyModel.findOne({ id, orgId });
  if (!doc) return null;
  return docToRow(doc);
}

export async function getApiKeyStatus(id: number, orgId: string): Promise<ApiKeyStatusResult | null> {
  const doc = await ApiKeyModel.findOne({ id, orgId });
  if (!doc) return null;

  const is_connected = Boolean(doc.first_event_at || (doc.event_count && doc.event_count > 0));

  return {
    id: doc.id,
    app_name: doc.app_name,
    is_active: doc.is_active,
    connection_method: doc.connection_method || 'code',
    is_connected,
    first_event_at: doc.first_event_at ?? null,
    last_used_at: doc.last_used_at ?? null,
    event_count: doc.event_count ?? 0,
  };
}

export async function recordApiKeyIngestEvent(id: number, count: number = 1): Promise<void> {
  const now = new Date();
  await ApiKeyModel.updateOne(
    { id },
    {
      $set: { last_used_at: now },
      $inc: { event_count: count },
      $min: { first_event_at: now },
    },
  );
}

export async function revokeApiKey(id: number, orgId: string): Promise<ApiKeyRow | null> {
  const doc = await ApiKeyModel.findOneAndUpdate(
    { id, orgId },
    { $set: { is_active: false } },
    { new: true },
  );

  if (!doc) return null;
  return docToRow(doc);
}
