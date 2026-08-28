import type { Role } from '../auth/permissions.js';
import { UserModel, RefreshTokenModel, getNextSequence, type IUserDoc } from '../config/mongoSchemas.js';

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  role: Role;
  is_active: boolean;
  suspended_reason: string | null;
  suspended_at: Date | null;
  created_at: Date;
}

export type SafeUserRow = Omit<UserRow, 'password_hash'>;

function docToUserRow(doc: IUserDoc): UserRow {
  return {
    id: doc.id,
    email: doc.email,
    password_hash: doc.password_hash,
    role: doc.role,
    is_active: doc.is_active,
    suspended_reason: doc.suspended_reason ?? null,
    suspended_at: doc.suspended_at ?? null,
    created_at: doc.created_at,
  };
}

function docToSafeUserRow(doc: IUserDoc): SafeUserRow {
  const { password_hash, ...safe } = docToUserRow(doc);
  return safe;
}

export async function findByEmail(email: string): Promise<UserRow | null> {
  const doc = await UserModel.findOne({ email: email.toLowerCase().trim() });
  return doc ? docToUserRow(doc) : null;
}

export async function findById(id: number): Promise<UserRow | null> {
  const doc = await UserModel.findOne({ id });
  return doc ? docToUserRow(doc) : null;
}

export async function getAllUsers(): Promise<SafeUserRow[]> {
  const docs = await UserModel.find().sort({ id: 1 });
  return docs.map(docToSafeUserRow);
}

export async function getActiveAdminCount(): Promise<number> {
  return await UserModel.countDocuments({ role: 'admin', is_active: true });
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  role: Role;
}

export async function createUser(input: CreateUserInput): Promise<UserRow> {
  const nextId = await getNextSequence('users');
  const doc = await UserModel.create({
    id: nextId,
    email: input.email.toLowerCase().trim(),
    password_hash: input.passwordHash,
    role: input.role,
    is_active: true,
  });
  return docToUserRow(doc);
}

export async function suspendUser(id: number, reason: string): Promise<SafeUserRow | null> {
  const doc = await UserModel.findOneAndUpdate(
    { id },
    { is_active: false, suspended_reason: reason, suspended_at: new Date() },
    { new: true },
  );

  if (doc) {
    await revokeAllUserTokens(id);
    return docToSafeUserRow(doc);
  }

  return null;
}

export async function reactivateUser(id: number): Promise<SafeUserRow | null> {
  const doc = await UserModel.findOneAndUpdate(
    { id },
    { is_active: true, suspended_reason: null, suspended_at: null },
    { new: true },
  );
  return doc ? docToSafeUserRow(doc) : null;
}

export async function updateUserRole(id: number, role: Role): Promise<SafeUserRow | null> {
  const doc = await UserModel.findOneAndUpdate({ id }, { role }, { new: true });
  return doc ? docToSafeUserRow(doc) : null;
}

export async function revokeAllUserTokens(userId: number): Promise<void> {
  await RefreshTokenModel.updateMany({ user_id: userId }, { revoked: true });
}

/** Upsert used by the admin seed script — idempotent on email. */
export async function upsertUser(input: CreateUserInput): Promise<UserRow> {
  const existing = await UserModel.findOne({ email: input.email.toLowerCase().trim() });
  if (existing) {
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
