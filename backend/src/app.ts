import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import logsRoutes from './routes/logs.routes.js';
import rulesRoutes from './routes/rules.routes.js';
import alertsRoutes from './routes/alerts.routes.js';
import usersRoutes from './routes/users.routes.js';
import blocklistRoutes from './routes/blocklist.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import auditRoutes from './routes/audit.routes.js';
import mitreRoutes from './routes/mitre.routes.js';
import apiKeysRoutes from './routes/apiKeys.routes.js';
import tenantDbRoutes from './routes/tenantDb.routes.js';
import sdkRoutes from './routes/sdk.routes.js';

/**
 * Builds the Express app WITHOUT starting a listener, so tests can import it
 * and drive it with supertest. `index.ts` imports this and calls listen().
 */
export function createApp() {
  const app = express();

  // Security headers. CSP is left default-off here since the API serves JSON
  // only; the frontend sets its own CSP.
  app.use(helmet({ crossOriginResourcePolicy: false }));

  // Allow open CORS for public SDK delivery and external log ingestion,
  // while securing console dashboard routes with credentials.
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/logs/ingest') || req.path.startsWith('/api/sdk')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, x-api-key, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
      }
    }
    next();
  });

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true, // allow the httpOnly refresh cookie
    }),
  );
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  // Routes (all under /api)
  app.use('/api/sdk', sdkRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/logs', logsRoutes);
  app.use('/api/rules', rulesRoutes);
  app.use('/api/alerts', alertsRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/blocklist', blocklistRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/mitre', mitreRoutes);
  app.use('/api/api-keys', apiKeysRoutes);
  app.use('/api/tenant-db', tenantDbRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
