import mongoose from 'mongoose';
import dns from 'node:dns';
import { env } from './env.js';
import { logger } from './logger.js';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch {
  // Ignore fallback if setServers not permitted
}

let isConnected = false;

export async function connectDb(): Promise<typeof mongoose> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  try {
    const conn = await mongoose.connect(env.MONGODB_URI);
    isConnected = true;
    logger.info('Connected to MongoDB database', { uri: env.MONGODB_URI });
    return conn;
  } catch (err) {
    logger.error('Failed to connect to MongoDB', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function pingDb(): Promise<boolean> {
  try {
    if (mongoose.connection.readyState !== 1) {
      await connectDb();
    }
    return mongoose.connection.readyState === 1;
  } catch {
    return false;
  }
}

// Auto-connect on startup
connectDb().catch(() => {});
