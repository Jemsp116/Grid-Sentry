import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

/**
 * Central, validated environment config. The app refuses to start if a required
 * variable is missing or malformed — better to fail loudly at boot than to
 * discover a missing JWT secret on the first login attempt.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  MONGODB_URI: z.string().default('mongodb://mongodb:27017/gridsentry'),

  OPENSEARCH_NODE: z.string().url().default('http://opensearch:9200'),
  OPENSEARCH_USERNAME: z.string().optional(),
  OPENSEARCH_PASSWORD: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be set (>=16 chars)'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be set (>=16 chars)'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  ABUSEIPDB_API_KEY: z.string().optional(),

  /** Master key for BYODB connection-string encryption (see utils/kmsEncryption.ts). */
  KMS_MASTER_KEY: z.string().default('grid-sentry-byodb-kms-secret-master-key-2026'),

  INGEST_API_KEY: z.string().default('gs_live_secret_key_2026'),

  /** App base URL used in invitation email links (no trailing slash). */
  APP_BASE_URL: z.string().url().optional(),

  /** SMTP settings for invitation emails (all optional; falls back to dev logging). */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

function loadDotenvFiles() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env'),
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch {}
    }
  }
}

function loadEnv() {
  loadDotenvFiles();
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error(`\nInvalid environment configuration:\n${issues}\n`);
    process.exit(1);
  }

  if (parsed.data.JWT_ACCESS_SECRET === parsed.data.JWT_REFRESH_SECRET) {
    // eslint-disable-next-line no-console
    console.error(
      '\nJWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.\n',
    );
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;
