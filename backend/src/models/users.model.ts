import { query } from '../config/db.js';
import type { Role } from '../auth/permissions.js';

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

export async function findByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>(
    'SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1',
    [email],
  );
  return rows[0] ?? null;
}

export async function findById(id: number): Promise<UserRow | null> {
  const { rows } = await query<UserRow>('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
  return rows[0] ?? null;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  role: Role;
}

export async function createUser(input: CreateUserInput): Promise<UserRow> {
  const { rows } = await query<UserRow>(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.email, input.passwordHash, input.role],
  );
  return rows[0]!;
}

/** Upsert used by the admin seed script — idempotent on email. */
export async function upsertUser(input: CreateUserInput): Promise<UserRow> {
  const { rows } = await query<UserRow>(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role          = EXCLUDED.role,
           is_active     = true,
           suspended_reason = NULL,
           suspended_at  = NULL
     RETURNING *`,
    [input.email, input.passwordHash, input.role],
  );
  return rows[0]!;
}
