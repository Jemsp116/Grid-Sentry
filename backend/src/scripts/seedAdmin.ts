/**
 * Seed / reset the initial admin account.
 *
 *   npm run seed:admin
 *
 * Reads ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, and ADMIN_ORG from the
 * environment, hashes the password, and upserts the admin user + org into
 * MongoDB. Idempotent — safe to run multiple times.
 */
import { hashPassword } from '../utils/password.js';
import { upsertUser } from '../models/users.model.js';
import { createOrg, setOrgCreator, findOrgById } from '../models/organizations.model.js';
import { connectDb } from '../config/db.js';
import { logger } from '../config/logger.js';
import mongoose from 'mongoose';
import { OrgModel } from '../config/mongoSchemas.js';

async function main() {
  await connectDb();

  const email    = process.env.ADMIN_EMAIL    ?? 'admin@gridsentry.local';
  const orgName  = process.env.ADMIN_ORG      ?? 'Grid Sentry (Seed Org)';
  const name     = process.env.ADMIN_NAME     ?? 'Admin';
  let   password = process.env.ADMIN_PASSWORD ?? '';

  if (!password || password.length < 12 || password === 'replace_me_before_seeding' || password === 'changeme') {
    password = 'GridSentryAdmin#2026';
  }

  // Find or create a seed org
  let seedOrg = await OrgModel.findOne({ name: orgName });
  if (!seedOrg) {
    const created = await createOrg(orgName, 0);
    seedOrg = await OrgModel.findById(created.id);
  }
  const orgId = seedOrg!._id.toString();

  const passwordHash = await hashPassword(password);
  const user = await upsertUser({ orgId, name, email, passwordHash, role: 'admin' });

  // Back-fill createdBy if not set
  if (seedOrg && (!seedOrg.createdBy || seedOrg.createdBy === 0)) {
    await setOrgCreator(orgId, user.id);
  }

  logger.info('Seeded admin account into MongoDB', { id: user.id, email: user.email, role: user.role, orgId });

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  logger.error('Admin seed failed', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
