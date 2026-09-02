import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { evaluateRulesOnce } from './ruleEvaluator.js';

/**
 * Grid Sentry detection worker.
 *
 * Polls MongoDB for active detection rules on a fixed interval, evaluates each
 * one against recent OpenSearch log events, and writes alerts (optionally
 * auto-blocking the source IP) when a rule's threshold is crossed. The actual
 * evaluation lives in `ruleEvaluator.ts`; this file is just the boot sequence,
 * env validation, and the poll loop.
 *
 * NOTE: `loadDotenvFiles` below is duplicated from `backend/src/config/env.ts`.
 * `backend/` and `worker/` are independent npm packages with no workspace root,
 * so there is nowhere to share it from — keep the two copies in sync.
 */

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

loadDotenvFiles();

const EnvSchema = z.object({
  MONGODB_URI: z.string().optional(),
  OPENSEARCH_NODE: z.string().url().default('http://opensearch:9200'),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid worker environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
const env = parsed.data;

function log(msg: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), svc: 'worker', msg, ...meta }));
}

let running = true;

async function runTick(): Promise<void> {
  const alertsCreated = await evaluateRulesOnce();
  if (alertsCreated > 0) {
    log('detection tick completed', { alertsCreated });
  }
}

async function mainLoop(): Promise<void> {
  log('Grid Sentry worker started', {
    opensearch: env.OPENSEARCH_NODE,
    pollIntervalMs: env.POLL_INTERVAL_MS,
  });
  while (running) {
    try {
      await runTick();
    } catch (err) {
      log('evaluation error', { error: err instanceof Error ? err.message : String(err) });
    }
    await new Promise((r) => setTimeout(r, env.POLL_INTERVAL_MS));
  }
}

function shutdown(signal: string) {
  log('shutting down', { signal });
  running = false;
  setTimeout(() => process.exit(0), 500).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

mainLoop().catch((err) => {
  log('fatal', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
