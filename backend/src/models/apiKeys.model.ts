import crypto from 'node:crypto';
import { ApiKeyModel, getNextSequence } from '../config/mongoSchemas.js';

export interface ApiKeyRow {
  id: number;
  app_name: string;
  is_active: boolean;
  created_by: number;
  last_used_at: Date | null;
  created_at: Date;
}

export interface CreatedApiKeyResult extends ApiKeyRow {
  raw_key: string;
}

export function generateRawApiKey(): string {
  return `gs_live_${crypto.randomBytes(24).toString('hex')}`;
}

export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
}

export async function createApiKey(appName: string, createdBy: number): Promise<CreatedApiKeyResult> {
  const rawKey = generateRawApiKey();
  const keyHash = hashApiKey(rawKey);
  const nextId = await getNextSequence('api_keys');

  const doc = await ApiKeyModel.create({
    id: nextId,
    app_name: appName.trim(),
    key_hash: keyHash,
    is_active: true,
    created_by: createdBy,
    last_used_at: null,
    created_at: new Date(),
  });

  return {
    id: doc.id,
    app_name: doc.app_name,
    is_active: doc.is_active,
    created_by: doc.created_by,
    last_used_at: doc.last_used_at ?? null,
    created_at: doc.created_at,
    raw_key: rawKey,
  };
}

export async function listApiKeys(): Promise<ApiKeyRow[]> {
  const docs = await ApiKeyModel.find().sort({ created_at: -1 });
  return docs.map((doc) => ({
    id: doc.id,
    app_name: doc.app_name,
    is_active: doc.is_active,
    created_by: doc.created_by,
    last_used_at: doc.last_used_at ?? null,
    created_at: doc.created_at,
  }));
}

export async function findActiveApiKeyByHash(keyHash: string): Promise<ApiKeyRow | null> {
  const doc = await ApiKeyModel.findOne({ key_hash: keyHash, is_active: true });
  if (!doc) return null;
  return {
    id: doc.id,
    app_name: doc.app_name,
    is_active: doc.is_active,
    created_by: doc.created_by,
    last_used_at: doc.last_used_at ?? null,
    created_at: doc.created_at,
  };
}

export async function updateApiKeyLastUsed(id: number): Promise<void> {
  await ApiKeyModel.updateOne({ id }, { $set: { last_used_at: new Date() } });
}

export async function revokeApiKey(id: number): Promise<ApiKeyRow | null> {
  const doc = await ApiKeyModel.findOneAndUpdate(
    { id },
    { $set: { is_active: false } },
    { new: true },
  );

  if (!doc) return null;
  return {
    id: doc.id,
    app_name: doc.app_name,
    is_active: doc.is_active,
    created_by: doc.created_by,
    last_used_at: doc.last_used_at ?? null,
    created_at: doc.created_at,
  };
}
