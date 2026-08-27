import { Client } from '@opensearch-project/opensearch';
import { env } from './env.js';
import { logger } from './logger.js';

/**
 * OpenSearch client. The dev stack runs OpenSearch with the security plugin
 * disabled, so auth is only attached when a username is actually provided.
 */
export const opensearch = new Client({
  node: env.OPENSEARCH_NODE,
  ...(env.OPENSEARCH_USERNAME
    ? {
        auth: {
          username: env.OPENSEARCH_USERNAME,
          password: env.OPENSEARCH_PASSWORD ?? '',
        },
      }
    : {}),
  // Dev single-node uses a self-signed/plain endpoint; don't hard-fail on TLS.
  ssl: { rejectUnauthorized: false },
});

export async function pingOpenSearch(): Promise<boolean> {
  try {
    await opensearch.ping();
    return true;
  } catch (err) {
    logger.warn('OpenSearch ping failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
