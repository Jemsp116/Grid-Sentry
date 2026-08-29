import mongoose, { Schema, type Document, type Model } from 'mongoose';

// ─── Numeric Counter Helper ──────────────────────────────────────────────────
const CounterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
export const CounterModel = (mongoose.models.Counter as Model<any>) || mongoose.model('Counter', CounterSchema);

export async function getNextSequence(name: string): Promise<number> {
  const ret = await CounterModel.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return ret.seq;
}

// ─── 1. User Schema ─────────────────────────────────────────────────────────
export interface IUserDoc extends Document {
  id: number;
  email: string;
  password_hash: string;
  role: 'viewer' | 'analyst' | 'admin';
  is_active: boolean;
  suspended_reason?: string | null;
  suspended_at?: Date | null;
  created_at: Date;
}

const UserSchema = new Schema<IUserDoc>({
  id: { type: Number, unique: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  role: { type: String, enum: ['viewer', 'analyst', 'admin'], default: 'viewer' },
  is_active: { type: Boolean, default: true },
  suspended_reason: { type: String, default: null },
  suspended_at: { type: Date, default: null },
  created_at: { type: Date, default: Date.now },
});

export const UserModel: Model<IUserDoc> =
  (mongoose.models.User as Model<IUserDoc>) || mongoose.model<IUserDoc>('User', UserSchema);

// ─── 2. Refresh Token Schema ────────────────────────────────────────────────
export interface IRefreshTokenDoc extends Document {
  id: number;
  user_id: number;
  token_hash: string;
  revoked: boolean;
  expires_at: Date;
  created_at: Date;
}

const RefreshTokenSchema = new Schema<IRefreshTokenDoc>({
  id: { type: Number, unique: true, index: true },
  user_id: { type: Number, required: true, index: true },
  token_hash: { type: String, required: true, index: true },
  revoked: { type: Boolean, default: false },
  expires_at: { type: Date, required: true },
  created_at: { type: Date, default: Date.now },
});

export const RefreshTokenModel: Model<IRefreshTokenDoc> =
  (mongoose.models.RefreshToken as Model<IRefreshTokenDoc>) ||
  mongoose.model<IRefreshTokenDoc>('RefreshToken', RefreshTokenSchema);

// ─── 3. Rule Schema ─────────────────────────────────────────────────────────
export interface IRuleDoc extends Document {
  id: number;
  name: string;
  description?: string | null;
  log_source: string;
  match_conditions: Record<string, unknown>;
  threshold: number;
  time_window_seconds: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mitre_technique_id?: string | null;
  action_on_trigger: 'alert_only' | 'alert_and_block_ip';
  is_active: boolean;
  created_by?: number | null;
  created_at: Date;
  updated_at: Date;
}

const RuleSchema = new Schema<IRuleDoc>({
  id: { type: Number, unique: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: null },
  log_source: { type: String, required: true },
  match_conditions: { type: Schema.Types.Mixed, required: true },
  threshold: { type: Number, default: 1 },
  time_window_seconds: { type: Number, default: 60 },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  mitre_technique_id: { type: String, default: null },
  action_on_trigger: { type: String, enum: ['alert_only', 'alert_and_block_ip'], default: 'alert_only' },
  is_active: { type: Boolean, default: true },
  created_by: { type: Number, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

export const RuleModel: Model<IRuleDoc> =
  (mongoose.models.Rule as Model<IRuleDoc>) || mongoose.model<IRuleDoc>('Rule', RuleSchema);

// ─── 4. Alert Schema ────────────────────────────────────────────────────────
export interface IAlertDoc extends Document {
  id: number;
  rule_id: number;
  source_ip: string;
  target_host?: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'investigating' | 'resolved' | 'false_positive';
  opensearch_log_ids: string[];
  assigned_to?: number | null;
  created_at: Date;
}

const AlertSchema = new Schema<IAlertDoc>({
  id: { type: Number, unique: true, index: true },
  rule_id: { type: Number, required: true, index: true },
  source_ip: { type: String, required: true, index: true },
  target_host: { type: String, default: null },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  status: { type: String, enum: ['new', 'investigating', 'resolved', 'false_positive'], default: 'new', index: true },
  opensearch_log_ids: { type: [String], default: [] },
  assigned_to: { type: Number, default: null },
  created_at: { type: Date, default: Date.now, index: true },
});

export const AlertModel: Model<IAlertDoc> =
  (mongoose.models.Alert as Model<IAlertDoc>) || mongoose.model<IAlertDoc>('Alert', AlertSchema);

// ─── 5. Alert Note Schema ───────────────────────────────────────────────────
export interface IAlertNoteDoc extends Document {
  id: number;
  alert_id: number;
  user_id: number;
  note: string;
  created_at: Date;
}

const AlertNoteSchema = new Schema<IAlertNoteDoc>({
  id: { type: Number, unique: true, index: true },
  alert_id: { type: Number, required: true, index: true },
  user_id: { type: Number, required: true },
  note: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
});

export const AlertNoteModel: Model<IAlertNoteDoc> =
  (mongoose.models.AlertNote as Model<IAlertNoteDoc>) ||
  mongoose.model<IAlertNoteDoc>('AlertNote', AlertNoteSchema);

// ─── 6. IP Blocklist Schema ──────────────────────────────────────────────────
export interface IIPBlocklistDoc extends Document {
  id: number;
  ip_address: string;
  reason?: string | null;
  triggered_by_rule_id?: number | null;
  added_by?: number | null;
  expires_at?: Date | null;
  created_at: Date;
}

const IPBlocklistSchema = new Schema<IIPBlocklistDoc>({
  id: { type: Number, unique: true, index: true },
  ip_address: { type: String, required: true, unique: true, index: true },
  reason: { type: String, default: null },
  triggered_by_rule_id: { type: Number, default: null },
  added_by: { type: Number, default: null },
  expires_at: { type: Date, default: null },
  created_at: { type: Date, default: Date.now },
});

export const IPBlocklistModel: Model<IIPBlocklistDoc> =
  (mongoose.models.IPBlocklist as Model<IIPBlocklistDoc>) ||
  mongoose.model<IIPBlocklistDoc>('IPBlocklist', IPBlocklistSchema);

// ─── 7. Audit Log Schema ────────────────────────────────────────────────────
export interface IAuditLogDoc extends Document {
  id: number;
  user_id?: number | null;
  action: string;
  target_type: string;
  target_id?: number | null;
  details?: Record<string, unknown> | null;
  created_at: Date;
}

const AuditLogSchema = new Schema<IAuditLogDoc>({
  id: { type: Number, unique: true, index: true },
  user_id: { type: Number, default: null, index: true },
  action: { type: String, required: true, index: true },
  target_type: { type: String, required: true },
  target_id: { type: Number, default: null },
  details: { type: Schema.Types.Mixed, default: null },
  created_at: { type: Date, default: Date.now, index: true },
});

export const AuditLogModel: Model<IAuditLogDoc> =
  (mongoose.models.AuditLog as Model<IAuditLogDoc>) ||
  mongoose.model<IAuditLogDoc>('AuditLog', AuditLogSchema);

// ─── 8. API Key Schema ──────────────────────────────────────────────────────
export interface IApiKeyDoc extends Document {
  id: number;
  app_name: string;
  key_hash: string;
  is_active: boolean;
  created_by: number;
  last_used_at?: Date | null;
  created_at: Date;
}

const ApiKeySchema = new Schema<IApiKeyDoc>({
  id: { type: Number, unique: true, index: true },
  app_name: { type: String, required: true },
  key_hash: { type: String, required: true, unique: true, index: true },
  is_active: { type: Boolean, default: true, index: true },
  created_by: { type: Number, required: true, index: true },
  last_used_at: { type: Date, default: null },
  created_at: { type: Date, default: Date.now },
});

export const ApiKeyModel: Model<IApiKeyDoc> =
  (mongoose.models.ApiKey as Model<IApiKeyDoc>) ||
  mongoose.model<IApiKeyDoc>('ApiKey', ApiKeySchema);

// ─── 9. Tenant Database (BYODB) Schema ──────────────────────────────────────
export interface ITenantDatabaseDoc extends Document {
  id: number;
  user_id: number;
  db_type: 'mongodb';
  encrypted_connection_string: string;
  encryption_key_id: string;
  connection_status: 'pending' | 'verified' | 'failed';
  last_verified_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

const TenantDatabaseSchema = new Schema<ITenantDatabaseDoc>({
  id: { type: Number, unique: true, index: true },
  user_id: { type: Number, required: true, unique: true, index: true },
  db_type: { type: String, enum: ['mongodb'], default: 'mongodb' },
  encrypted_connection_string: { type: String, required: true },
  encryption_key_id: { type: String, required: true, default: 'kms-key-v1' },
  connection_status: {
    type: String,
    enum: ['pending', 'verified', 'failed'],
    default: 'pending',
    index: true,
  },
  last_verified_at: { type: Date, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

export const TenantDatabaseModel: Model<ITenantDatabaseDoc> =
  (mongoose.models.TenantDatabase as Model<ITenantDatabaseDoc>) ||
  mongoose.model<ITenantDatabaseDoc>('TenantDatabase', TenantDatabaseSchema);


