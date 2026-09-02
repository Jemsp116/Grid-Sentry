import mongoose from 'mongoose';
import { env } from '../config/env.js';
import {
  OrgModel,
  UserModel,
  ApiKeyModel,
  AlertModel,
  RuleModel,
  IPBlocklistModel,
  AuditLogModel,
  TenantDatabaseModel,
} from '../config/mongoSchemas.js';

async function main() {
  console.log('Connecting to MongoDB database...');
  await mongoose.connect(env.MONGODB_URI);

  console.log('\n=== RUNNING GRID SENTRY TEST DATA PURGE ===\n');

  // 1. Delete all demo / fake alerts
  const deletedAlerts = await AlertModel.deleteMany({
    $or: [
      { source_ip: { $in: ['192.168.1.105', '10.0.0.42'] } },
      { opensearch_log_ids: { $in: ['demo-log-1', 'demo-log-2', 'demo-log-3'] } },
    ],
  });
  console.log(`✓ Deleted ${deletedAlerts.deletedCount} demo/fake alert records.`);

  // 2. Delete test/dummy API keys / connected sources
  const testAppNames = ['qwe', 'zsdvsd', 'test', 'cyber', 'patel', 'jems', 'my-vercel-app'];
  const deletedApiKeys = await ApiKeyModel.deleteMany({
    $or: [
      { app_name: { $in: testAppNames } },
      { orgId: { $exists: false } },
      { orgId: null },
    ],
  });
  console.log(`✓ Deleted ${deletedApiKeys.deletedCount} test/dummy API key records.`);

  // 3. Delete orphan duplicate rules without orgId
  const deletedRules = await RuleModel.deleteMany({
    $or: [
      { orgId: { $exists: false } },
      { orgId: null },
    ],
  });
  console.log(`✓ Deleted ${deletedRules.deletedCount} orphan/unscoped rule records.`);

  // Also delete all duplicate auto-generated demo rules from earlier runs if any
  const demoRuleNames = ['SSH Brute Force', 'SSH Invalid User Login'];
  const deletedDemoRules = await RuleModel.deleteMany({
    name: { $in: demoRuleNames },
  });
  console.log(`✓ Purged ${deletedDemoRules.deletedCount} auto-seeded rules.`);

  // 4. Delete fake/demo audit log entries
  const deletedAudit = await AuditLogModel.deleteMany({
    $or: [
      { 'details.ipAddress': '192.168.1.105' },
      { 'details.app_name': { $in: testAppNames } },
      { orgId: { $exists: false } },
      { orgId: null },
    ],
  });
  console.log(`✓ Deleted ${deletedAudit.deletedCount} demo/test audit log records.`);

  // 5. Delete demo/fake IP blocklist entries
  const deletedBlocklist = await IPBlocklistModel.deleteMany({
    $or: [
      { ip_address: { $in: ['192.168.1.105', '10.0.0.42'] } },
      { orgId: { $exists: false } },
      { orgId: null },
    ],
  });
  console.log(`✓ Deleted ${deletedBlocklist.deletedCount} demo/test blocklist records.`);

  // Output remaining clean state summary
  console.log('\n=== CURRENT DATABASE STATE AFTER CLEANUP ===');
  console.log('Organizations count:', await OrgModel.countDocuments());
  console.log('Users count:', await UserModel.countDocuments());
  console.log('API Keys count:', await ApiKeyModel.countDocuments());
  console.log('Alerts count:', await AlertModel.countDocuments());
  console.log('Rules count:', await RuleModel.countDocuments());
  console.log('Blocklist count:', await IPBlocklistModel.countDocuments());
  console.log('Audit Log count:', await AuditLogModel.countDocuments());
  console.log('Tenant DBs count:', await TenantDatabaseModel.countDocuments());

  await mongoose.disconnect();
  console.log('\n✓ Database cleanup completed successfully.');
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
