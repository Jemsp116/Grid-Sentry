import type { Role } from '../auth/permissions.js';
import { UserModel, RefreshTokenModel, getNextSequence, type IUserDoc } from '../config/mongoSchemas.js';
import type { Types } from 'mongoose';

export interface UserRow {
  id: number;
  orgId: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  is_active: boolean;
  invitedBy: number | null;
  suspended_reason: string | null;
  suspended_at: Date | null;
  created_at: Date;
}

export type SafeUserRow = Omit<UserRow, 'password_hash'>;

function docToUserRow(doc: IUserDoc): UserRow {
  return {
    id: doc.id,
    orgId: doc.orgId ? doc.orgId.toString() : '',
    name: doc.name || 'Admin',
    email: doc.email,
    password_hash: doc.password_hash,
    role: doc.role,
    is_active: doc.is_active,
    invitedBy: doc.invitedBy ?? null,
    suspended_reason: doc.suspended_reason ?? null,
    suspended_at: doc.suspended_at ?? null,
    created_at: doc.created_at,
  };
}

function docToSafeUserRow(doc: IUserDoc): SafeUserRow {
  const { password_hash, ...safe } = docToUserRow(doc);
  return safe;
}

/**
 * Find a user by email — global lookup used during login where orgId is not
 * yet known. The email field is globally unique so this is safe.
 */
export async function findByEmail(email: string): Promise<UserRow | null> {
  const doc = await UserModel.findOne({ email: email.toLowerCase().trim() });
  return doc ? docToUserRow(doc) : null;
}

/** Find a user by numeric id — used internally after auth resolves orgId. */
export async function findById(id: number): Promise<UserRow | null> {
  const doc = await UserModel.findOne({ id });
  return doc ? docToUserRow(doc) : null;
}

/** Find a user by numeric id scoped to a specific org (for controller use). */
export async function findByIdInOrg(id: number, orgId: string): Promise<UserRow | null> {
  const doc = await UserModel.findOne({ id, orgId });
  return doc ? docToUserRow(doc) : null;
}

/** List all users in an org (safe — no password hash). */
export async function getAllUsers(orgId: string): Promise<SafeUserRow[]> {
  const docs = await UserModel.find({ orgId }).sort({ id: 1 });
  return docs.map(docToSafeUserRow);
}

/** Count active admins within a specific org. */
export async function getActiveAdminCount(orgId: string): Promise<number> {
  return await UserModel.countDocuments({ orgId, role: 'admin', is_active: true });
}

export interface CreateUserInput {
  orgId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  invitedBy?: number | null;
}

export async function createUser(input: CreateUserInput): Promise<UserRow> {
  const nextId = await getNextSequence('users');
  const doc = await UserModel.create({
    id: nextId,
    orgId: input.orgId,
    name: input.name,
    email: input.email.toLowerCase().trim(),
    password_hash: input.passwordHash,
    role: input.role,
    is_active: true,
    invitedBy: input.invitedBy ?? null,
  });
  return docToUserRow(doc);
}

export async function suspendUser(id: number, orgId: string, reason: string): Promise<SafeUserRow | null> {
  const doc = await UserModel.findOneAndUpdate(
    { id, orgId },
    { is_active: false, suspended_reason: reason, suspended_at: new Date() },
    { new: true },
  );

  if (doc) {
    await revokeAllUserTokens(id);
    return docToSafeUserRow(doc);
  }

  return null;
}

export async function reactivateUser(id: number, orgId: string): Promise<SafeUserRow | null> {
  const doc = await UserModel.findOneAndUpdate(
    { id, orgId },
    { is_active: true, suspended_reason: null, suspended_at: null },
    { new: true },
  );
  return doc ? docToSafeUserRow(doc) : null;
}

export async function updateUserRole(id: number, orgId: string, role: Role): Promise<SafeUserRow | null> {
  const doc = await UserModel.findOneAndUpdate({ id, orgId }, { role }, { new: true });
  return doc ? docToSafeUserRow(doc) : null;
}

export async function revokeAllUserTokens(userId: number): Promise<void> {
  await RefreshTokenModel.updateMany({ user_id: userId }, { revoked: true });
}

/** Upsert used by the admin seed script — idempotent on email. */
export async function upsertUser(input: CreateUserInput): Promise<UserRow> {
  const existing = await UserModel.findOne({ email: input.email.toLowerCase().trim() });
  if (existing) {
    existing.name = input.name || existing.name || 'Admin';
    if (!existing.orgId) {
      existing.orgId = input.orgId as any;
    }
    existing.password_hash = input.passwordHash;
    existing.role = input.role;
    existing.is_active = true;
    existing.suspended_reason = null;
    existing.suspended_at = null;
    await existing.save();
    return docToUserRow(existing);
  }

  return await createUser(input);
}


