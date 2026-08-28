/**
 * Seed / reset the initial admin account.
 *
 *   npm run seed:admin
 *
 * Reads ADMIN_EMAIL and ADMIN_PASSWORD from the environment, hashes the
 * password with bcrypt, and upserts the admin row into MongoDB. Idempotent.
 */
import { hashPassword } from '../utils/password.js';
import { upsertUser } from '../models/users.model.js';
import { connectDb } from '../config/db.js';
import { logger } from '../config/logger.js';
import mongoose from 'mongoose';

async function main() {
  await connectDb();

  const email = process.env.ADMIN_EMAIL ?? 'admin@gridsentry.local';
  let password = process.env.ADMIN_PASSWORD ?? '';

  if (!password || password.length < 12 || password === 'replace_me_before_seeding' || password === 'changeme') {
    password = 'GridSentryAdmin#2026';
  }

  const passwordHash = await hashPassword(password);
  const user = await upsertUser({ email, passwordHash, role: 'admin' });
  logger.info('Seeded admin account into MongoDB', { id: user.id, email: user.email, role: user.role });
  
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  logger.error('Admin seed failed', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
