import { Router, Request, Response, NextFunction } from 'express';
import { ReflectionEntryModel } from '../models/reflection.js';
import crypto from 'crypto';

const router = Router();

router.post('/api/reflection', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, triggerType, promptText, responseText, skipped } = req.body;

    if (!userId || !triggerType || !promptText) {
      return res.status(400).json({ error: 'userId, triggerType, and promptText are required' });
    }

    const entry = await ReflectionEntryModel.create({
      id: crypto.randomUUID(),
      user_id: userId,
      trigger_type: triggerType,
      prompt_text: promptText,
      response_text: responseText || null,
      skipped: skipped || false,
    });

    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
});

router.get('/api/reflection', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const entries = await ReflectionEntryModel.findByUserId(userId as string);
    res.json(entries);
  } catch (error) {
    next(error);
  }
});

export default router;
