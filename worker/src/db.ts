import mongoose, { Schema, type Model } from 'mongoose';
import dns from 'node:dns';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch {}

const mongodbUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/gridsentry';

let isConnected = false;

export async function connectWorkerDb(): Promise<typeof mongoose> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  try {
    const conn = await mongoose.connect(mongodbUri);
    isConnected = true;
    console.log(`[WORKER] Connected to MongoDB database (${mongodbUri})`);
    return conn;
  } catch (err) {
    console.error('[WORKER] Failed to connect to MongoDB', err);
    throw err;
  }
}

// ─── Sequence Counter ───────────────────────────────────────────────────────
const CounterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });
export const CounterModel: Model<any> = (mongoose.models.Counter as Model<any>) || mongoose.model('Counter', CounterSchema);

export async function getNextSequence(name: string): Promise<number> {
  const ret: any = await CounterModel.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return ret?.seq || 1;
}

// ─── Mongoose Models ────────────────────────────────────────────────────────
const RuleSchema = new Schema({
  id: { type: Number, unique: true },
  name: String,
  description: String,
  log_source: String,
  match_conditions: Schema.Types.Mixed,
  threshold: Number,
  time_window_seconds: Number,
  severity: String,
  mitre_technique_id: String,
  action_on_trigger: String,
  is_active: Boolean,
});
export const WorkerRuleModel: Model<any> = (mongoose.models.Rule as Model<any>) || mongoose.model('Rule', RuleSchema);

const AlertSchema = new Schema({
  id: { type: Number, unique: true },
  rule_id: Number,
  source_ip: String,
  target_host: String,
  severity: String,
  status: { type: String, default: 'new' },
  opensearch_log_ids: [String],
  assigned_to: Number,
  created_at: { type: Date, default: Date.now },
});
export const WorkerAlertModel: Model<any> = (mongoose.models.Alert as Model<any>) || mongoose.model('Alert', AlertSchema);

const IPBlocklistSchema = new Schema({
  id: { type: Number, unique: true },
  ip_address: { type: String, unique: true },
  reason: String,
  triggered_by_rule_id: Number,
  added_by: Number,
  expires_at: Date,
  created_at: { type: Date, default: Date.now },
});
export const WorkerBlocklistModel: Model<any> = (mongoose.models.IPBlocklist as Model<any>) || mongoose.model('IPBlocklist', IPBlocklistSchema);

const AuditLogSchema = new Schema({
  id: { type: Number, unique: true },
  user_id: Number,
  action: String,
  target_type: String,
  target_id: Number,
  details: Schema.Types.Mixed,
  created_at: { type: Date, default: Date.now },
});
export const WorkerAuditLogModel: Model<any> = (mongoose.models.AuditLog as Model<any>) || mongoose.model('AuditLog', AuditLogSchema);

connectWorkerDb().catch(() => {});
