import { Router, Request, Response, NextFunction } from 'express';
import { TelemetryModel } from '../models/telemetry.js';

const router = Router();

router.get('/api/telemetry', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await TelemetryModel.list();
    res.json(list);
  } catch (error) {
    next(error);
  }
});

router.delete('/api/telemetry', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await TelemetryModel.clear();
    res.json({ message: 'Telemetry logs cleared' });
  } catch (error) {
    next(error);
  }
});

export default router;
