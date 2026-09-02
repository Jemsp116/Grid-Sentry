import type { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import * as DashboardModel from '../models/dashboard.model.js';
import { seedDemoAlertsIfEmpty } from '../models/alerts.model.js';

const LookbackQuerySchema = z.object({
  lookbackHours: z.coerce.number().int().min(1).max(720).default(24),
});

export async function getSummary(req: Request, res: Response): Promise<void> {
  const parsed = LookbackQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid lookbackHours parameter');
  }

  if (!req.user) throw ApiError.unauthorized();
  await seedDemoAlertsIfEmpty(req.user.id, req.user.orgId);

  const summary = await DashboardModel.getDashboardSummary(parsed.data.lookbackHours);
  res.status(200).json({ status: 'ok', data: summary });
}

export async function getGeo(req: Request, res: Response): Promise<void> {
  const parsed = LookbackQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid lookbackHours parameter');
  }

  if (!req.user) throw ApiError.unauthorized();
  await seedDemoAlertsIfEmpty(req.user.id, req.user.orgId);

  const geo = await DashboardModel.getGeoMetrics(parsed.data.lookbackHours);
  res.status(200).json({ status: 'ok', data: geo });
}
