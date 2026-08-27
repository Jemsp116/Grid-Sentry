/**
 * Seed / reset the initial admin account.
 *
 *   npm run seed:admin
 *
 * Reads ADMIN_EMAIL and ADMIN_PASSWORD from the environment, hashes the
 * password with bcrypt, and upserts the admin row. Idempotent — safe to re-run
 * to reset the admin password. Intentionally NOT part of the SQL migration so
 * no password hash is ever committed to the repository.
 */
import { hashPassword } from '../utils/password.js';
import { upsertUser } from '../models/users.model.js';
import { pool } from '../config/db.js';
import { logger } from '../config/logger.js';

const PLACEHOLDERS = new Set(['replace_me_before_seeding', '', 'changeme']);

async function main() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@gridsentry.local';
  const password = process.env.ADMIN_PASSWORD ?? '';

  if (PLACEHOLDERS.has(password) || password.length < 12) {
    logger.error(
      'Refusing to seed: set ADMIN_PASSWORD to a real value of at least 12 characters in backend/.env',
    );
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const user = await upsertUser({ email, passwordHash, role: 'admin' });
  logger.info('Seeded admin account', { id: user.id, email: user.email, role: user.role });
  await pool.end();
}

main().catch((err) => {
  logger.error('Admin seed failed', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
