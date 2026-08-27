import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { pool } from './config/db.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info('Grid Sentry backend listening', { port: env.PORT, env: env.NODE_ENV });
});

// Graceful shutdown so `docker-compose down` / Ctrl-C closes connections cleanly.
function shutdown(signal: string) {
  logger.info('Shutting down', { signal });
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  // Force-exit if connections don't drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
