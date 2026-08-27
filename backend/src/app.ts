import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import protectedDemoRoutes from './routes/protected.demo.routes.js';

/**
 * Builds the Express app WITHOUT starting a listener, so tests can import it
 * and drive it with supertest. `index.ts` imports this and calls listen().
 */
export function createApp() {
  const app = express();

  // Security headers. CSP is left default-off here since the API serves JSON
  // only; the frontend sets its own CSP.
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true, // allow the httpOnly refresh cookie
    }),
  );
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  // Routes (all under /api)
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api', protectedDemoRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
