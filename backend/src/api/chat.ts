import { Router, Request, Response, NextFunction } from 'express';
import { coordinatorService } from '../coordinator/coordinator.service.js';
import { UserModel } from '../models/user.js';
import crypto from 'crypto';

const router = Router();

router.post('/api/chat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, message, state } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const targetUserId = userId || crypto.randomUUID();
    let user = await UserModel.findById(targetUserId);
    if (!user) {
      user = await UserModel.create({
        id: targetUserId,
        email: `learner-${targetUserId.slice(0, 8)}@bloom.edu`,
      });
    }

    const currentState = state || 'ONBOARDING_S1';

    const coordinatorResponse = await coordinatorService.processMessage(
      targetUserId,
      message,
      {
        userId: targetUserId,
        currentState,
        lastMessages: [],
      }
    );

    res.json({
      userId: targetUserId,
      response: coordinatorResponse.responseToUser,
      state: coordinatorResponse.newState,
      safetyCheckPassed: coordinatorResponse.safetyCheckPassed,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
