import mongoose from 'mongoose';
import { logger } from '../config/logger.js';

/**
 * Tenant Connection Pool Manager (TICKET Part 3 - BYODB).
 * Maintains independent, cached Mongoose connections per tenant user ID.
 */
class TenantConnectionManager {
  private connections = new Map<number, mongoose.Connection>();

  /**
   * Tests a tenant MongoDB connection string with a 5-second timeout.
   * Throws an error if connection fails. NEVER logs credentials.
   */
  public async testConnection(connectionString: string): Promise<boolean> {
    let testConn: mongoose.Connection | null = null;
    try {
      testConn = mongoose.createConnection(connectionString, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });

      // Wait for open event or timeout
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('MongoDB connection test timed out after 5000ms.'));
        }, 5000);

        testConn!.once('open', () => {
          clearTimeout(timer);
          resolve();
        });

        testConn!.once('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      // Run ping command to verify auth & permissions
      if (testConn.db) {
        await testConn.db.admin().ping();
      }

      await testConn.close();
      return true;
    } catch (err) {
      if (testConn) {
        testConn.close().catch(() => {});
      }
      logger.warn('Tenant MongoDB connection test failed');
      throw new Error(
        `Failed to connect to tenant MongoDB: ${err instanceof Error ? err.message : 'Connection failed'}`,
      );
    }
  }

  /**
   * Retrieves or creates an active Mongoose Connection for a specific tenant user.
   */
  public async getTenantConnection(userId: number, connectionString: string): Promise<mongoose.Connection> {
    const existing = this.connections.get(userId);
    if (existing && existing.readyState === 1) {
      return existing;
    }

    // Close any stale connection
    if (existing) {
      existing.close().catch(() => {});
      this.connections.delete(userId);
    }

    const conn = mongoose.createConnection(connectionString, {
      serverSelectionTimeoutMS: 5000,
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Tenant MongoDB connection timed out after 5000ms.'));
      }, 5000);

      conn.once('open', () => {
        clearTimeout(timer);
        resolve();
      });

      conn.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    this.connections.set(userId, conn);
    return conn;
  }

  /**
   * Closes and removes a tenant's active MongoDB connection.
   */
  public async closeTenantConnection(userId: number): Promise<void> {
    const conn = this.connections.get(userId);
    if (conn) {
      await conn.close().catch(() => {});
      this.connections.delete(userId);
      logger.info('Closed tenant database connection', { userId });
    }
  }

  /**
   * Closes all active tenant connections (utility for app shutdown).
   */
  public async closeAll(): Promise<void> {
    for (const [userId, conn] of this.connections.entries()) {
      await conn.close().catch(() => {});
      this.connections.delete(userId);
    }
  }
}

export const tenantConnectionManager = new TenantConnectionManager();
