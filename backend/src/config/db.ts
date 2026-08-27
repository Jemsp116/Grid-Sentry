import pg from 'pg';
import { env } from './env.js';
import { logger } from './logger.js';

/**
 * Shared Postgres connection pool. Import `pool` for ad-hoc queries, or use the
 * `query` helper which logs slow/failed statements.
 */
export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  logger.error('Unexpected Postgres pool error', { error: err.message });
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  try {
    return await pool.query<T>(text, params as any[]);
  } catch (err) {
    logger.error('Query failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/** Run a set of statements inside a single transaction (all-or-nothing). */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function pingDb(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
