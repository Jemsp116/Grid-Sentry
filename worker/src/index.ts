import { z } from 'zod';

/**
 * Grid Sentry detection worker — SKELETON (TICKET-000).
 *
 * For TICKET-000 this process just boots, validates its environment, and runs a
 * heartbeat loop so `docker-compose up` shows a healthy worker container. The
 * real rule-evaluation logic (reading active rules from Postgres, querying new
 * log events in OpenSearch, writing alerts) arrives in TICKET-005.
 */

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
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

async function evaluateRulesOnce(): Promise<void> {
  // TICKET-005: load active rules, query OpenSearch for new events since the
  // last checkpoint, evaluate threshold/time-window conditions, write alerts.
  // For now this is a no-op heartbeat.
  log('tick — detection engine not yet implemented (TICKET-005)');
}

async function mainLoop(): Promise<void> {
  log('Grid Sentry worker started', {
    opensearch: env.OPENSEARCH_NODE,
    pollIntervalMs: env.POLL_INTERVAL_MS,
  });
  while (running) {
    try {
      await evaluateRulesOnce();
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
