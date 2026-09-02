import { RefreshTokenModel, UserModel, getNextSequence, type IRefreshTokenDoc } from '../config/mongoSchemas.js';

export interface RefreshTokenRow {
  id: number;
  user_id: number;
  token_hash: string;
  revoked: boolean;
  expires_at: Date;
  created_at: Date;
}

function docToRow(doc: IRefreshTokenDoc): RefreshTokenRow {
  return {
    id: doc.id,
    user_id: doc.user_id,
    token_hash: doc.token_hash,
    revoked: doc.revoked,
    expires_at: doc.expires_at,
    created_at: doc.created_at,
  };
}

export async function createRefreshToken(input: {
  userId: number;
  tokenHash: string;
  expiresAt: Date;
}): Promise<RefreshTokenRow> {
  const nextId = await getNextSequence('refresh_tokens');
  const doc = await RefreshTokenModel.create({
    id: nextId,
    user_id: input.userId,
    token_hash: input.tokenHash,
    expires_at: input.expiresAt,
    revoked: false,
  });
  return docToRow(doc);
}

export async function findByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
  const doc = await RefreshTokenModel.findOne({ token_hash: tokenHash });
  return doc ? docToRow(doc) : null;
}

export async function revokeById(id: number): Promise<void> {
  await RefreshTokenModel.updateOne({ id }, { revoked: true });
}

/** Revoke every session for a user — used on suspension (TICKET-007). */
export async function revokeAllForUser(userId: number): Promise<number> {
  const res = await RefreshTokenModel.updateMany({ user_id: userId, revoked: false }, { revoked: true });
  return res.modifiedCount;
}

export interface SessionStatus {
  revoked: boolean;
  expires_at: Date;
  user_id: number;
  is_active: boolean;
  role: string;
  orgId: string;
}

export async function getSessionStatus(sid: number): Promise<SessionStatus | null> {
  const tokenDoc = await RefreshTokenModel.findOne({ id: sid });
  if (!tokenDoc) return null;

  const userDoc = await UserModel.findOne({ id: tokenDoc.user_id });
  if (!userDoc) return null;

  return {
    revoked: tokenDoc.revoked,
    expires_at: tokenDoc.expires_at,
    user_id: userDoc.id,
    is_active: userDoc.is_active,
    role: userDoc.role,
    orgId: userDoc.orgId ? userDoc.orgId.toString() : '',
  };
}
