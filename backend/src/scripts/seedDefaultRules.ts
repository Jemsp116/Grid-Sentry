import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { OrgModel, UserModel, RuleModel } from '../config/mongoSchemas.js';
import { createRule, type CreateRuleInput } from '../models/rules.model.js';
import { logger } from '../config/logger.js';

const DEFAULT_RULES: CreateRuleInput[] = [
  {
    name: 'SSH Brute Force Detection',
    description: 'Flags repeated failed SSH login attempts from the same source IP within a 60s window and auto-blocks the IP.',
    log_source: 'ssh_auth',
    match_conditions: [
      { field: 'event_type', operator: 'equals', value: 'auth' },
      { field: 'raw_message', operator: 'contains', value: 'Failed password' },
    ],
    threshold: 5,
    time_window_seconds: 60,
    severity: 'high',
    mitre_technique_id: 'T1110',
    action_on_trigger: 'alert_and_block_ip',
    is_active: true,
  },
  {
    name: 'SSH Invalid User Login',
    description: 'Flags SSH authentication attempts targeting invalid or nonexistent usernames.',
    log_source: 'ssh_auth',
    match_conditions: [
      { field: 'event_type', operator: 'equals', value: 'auth' },
      { field: 'raw_message', operator: 'contains', value: 'Invalid user' },
    ],
    threshold: 1,
    time_window_seconds: 60,
    severity: 'medium',
    mitre_technique_id: 'T1078',
    action_on_trigger: 'alert_only',
    is_active: true,
  },
];

async function seedRulesForOrg(orgName?: string) {
  await mongoose.connect(env.MONGODB_URI);
  logger.info('Connected to MongoDB for rule template seeding');

  let orgs;
  if (orgName) {
    orgs = await OrgModel.find({ name: orgName });
  } else {
    orgs = await OrgModel.find();
  }

  if (orgs.length === 0) {
    logger.warn('No organizations found to seed default rules for.');
    await mongoose.disconnect();
    return;
  }

  for (const org of orgs) {
    const orgId = org._id.toString();
    const existingCount = await RuleModel.countDocuments({ orgId });
    if (existingCount > 0) {
      logger.info(`Organization "${org.name}" already has ${existingCount} rules. Skipping.`);
      continue;
    }

    const adminUser = await UserModel.findOne({ orgId, role: 'admin' });
    const userId = adminUser?.id ?? 0;

    for (const rule of DEFAULT_RULES) {
      await createRule(rule, userId, orgId);
    }
    logger.info(`Seeded ${DEFAULT_RULES.length} default rule templates for organization "${org.name}" (${orgId}).`);
  }

  await mongoose.disconnect();
  logger.info('Rule template seeding complete.');
}

const targetOrg = process.argv[2];
seedRulesForOrg(targetOrg).catch((err) => {
  logger.error('Failed to seed rules', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
