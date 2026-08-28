import type { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import * as MitreModel from '../models/mitre.model.js';
import { seedDemoAlertsIfEmpty } from '../models/alerts.model.js';

const LookbackQuerySchema = z.object({
  lookbackHours: z.coerce.number().int().min(1).max(8760).default(24),
});

export async function getMatrix(req: Request, res: Response): Promise<void> {
  const parsed = LookbackQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid lookbackHours parameter');
  }

  const userId = req.user?.id ?? null;
  await seedDemoAlertsIfEmpty(userId);

  const matrix = await MitreModel.getMitreMatrix(parsed.data.lookbackHours);
  res.status(200).json({ status: 'ok', data: matrix });
}
