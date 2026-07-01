import { Router, Request, Response, NextFunction } from 'express';
import { WeeklyPlanModel } from '../models/plan.js';
import { LearningSessionModel } from '../models/session.js';

const router = Router();

router.get('/api/planning/latest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const latestPlan = await WeeklyPlanModel.findLatestByUserId(userId as string);
    if (!latestPlan) {
      return res.status(404).json({ error: 'No weekly plan found' });
    }

    const sessions = await LearningSessionModel.findByPlanId(latestPlan.id);

    res.json({
      plan: latestPlan,
      sessions,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
