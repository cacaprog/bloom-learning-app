import { Router, Request, Response, NextFunction } from 'express';
import { coordinatorService } from '../coordinator/coordinator.service.js';
import { UserModel } from '../models/user.js';
import { CoachMessageModel } from '../models/message.js';
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

    let finalMessage = message;
    const lowerMessage = message.toLowerCase().trim();
    if (lowerMessage === '/confirm-plan' || lowerMessage === 'i confirm the plan') {
      finalMessage = 'confirm';
    }

    // 1. Save incoming user message
    await CoachMessageModel.create({
      id: crypto.randomUUID(),
      user_id: targetUserId,
      role: 'user',
      mode: 'chat',
      state: currentState,
      content: message,
    });

    // 2. Fetch history (limit to last 15 messages)
    const history = await CoachMessageModel.findByUserId(targetUserId);
    const last15 = history.slice(-15);

    // 3. Delegate to Coordinator
    const coordinatorResponse = await coordinatorService.processMessage(
      targetUserId,
      finalMessage,
      {
        userId: targetUserId,
        currentState,
        lastMessages: last15,
      }
    );

    // 4. Save outgoing coach response
    await CoachMessageModel.create({
      id: crypto.randomUUID(),
      user_id: targetUserId,
      role: 'coach',
      mode: 'chat',
      state: coordinatorResponse.newState,
      content: coordinatorResponse.responseToUser,
      safety_check_passed: coordinatorResponse.safetyCheckPassed,
    });

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
