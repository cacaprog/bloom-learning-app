import { Router, Response, NextFunction } from 'express';
import { requireA2AScope, AuthenticatedA2ARequest } from './auth.js';
import { A2ATaskModel } from '../models/a2a.js';
import { coordinatorService } from '../coordinator/coordinator.service.js';
import { CoachMessageModel } from '../models/message.js';
import crypto from 'crypto';

const router = Router();

router.post(
  '/api/a2a',
  requireA2AScope('coach.plan'),
  async (req: AuthenticatedA2ARequest, res: Response, next: NextFunction) => {
    try {
      const { jsonrpc, method, params } = req.body;

      if (jsonrpc !== '2.0' || !method || !params || !params.id) {
        return res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Invalid Request' },
          id: params?.id || null,
        });
      }

      if (method !== 'tasks/send') {
        return res.status(404).json({
          jsonrpc: '2.0',
          error: { code: -32601, message: 'Method not found' },
          id: params.id,
        });
      }

      const messageParts = params.message?.parts || [];
      const skillPart = messageParts.find((p: any) => p.type === 'data');
      const data = skillPart?.data || {};

      if (data.skill_id !== 'plan_week') {
        return res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32602, message: 'Invalid params: unsupported skill_id' },
          id: params.id,
        });
      }

      const userId = data.user_id;
      const taskId = params.id;
      const caller = req.a2aCaller || 'external';

      // 1. Create A2ATask (submitted)
      await A2ATaskModel.create({
        id: taskId,
        user_id: userId,
        skill_id: data.skill_id,
        external_caller: caller,
        state: 'submitted',
        input_message: req.body,
      });

      // 2. Transition to working
      await A2ATaskModel.updateState(taskId, 'working');

      // 3. Save incoming user message
      await CoachMessageModel.create({
        id: crypto.randomUUID(),
        user_id: userId,
        role: 'user',
        mode: 'a2a',
        state: 'PLANNING',
        content: 'I confirm Option A',
      });

      // 4. Fetch history (limit to last 15 messages)
      const history = await CoachMessageModel.findByUserId(userId);
      const last15 = history.slice(-15);

      // 5. Delegate to Coordinator
      const coordinatorResponse = await coordinatorService.processMessage(
        userId,
        'I confirm Option A',
        {
          userId,
          currentState: 'PLANNING',
          lastMessages: last15,
        }
      );

      // 6. Save outgoing coach response
      await CoachMessageModel.create({
        id: crypto.randomUUID(),
        user_id: userId,
        role: 'coach',
        mode: 'a2a',
        state: coordinatorResponse.newState,
        content: coordinatorResponse.responseToUser,
        safety_check_passed: coordinatorResponse.safetyCheckPassed,
      });

      if (coordinatorResponse.newState === 'ACTIVE_WEEK') {
        const weeklyPlanArtifact = {
          name: 'weekly_plan',
          parts: [
            {
              type: 'data',
              data: {
                weekly_goal: 'Weekly study co-created via A2A delegation',
                confirmation_needed: false,
              },
            },
          ],
        };

        // 4. Transition to completed
        await A2ATaskModel.updateState(taskId, 'completed', weeklyPlanArtifact);

        return res.json({
          jsonrpc: '2.0',
          result: {
            id: taskId,
            state: 'completed',
            artifact: weeklyPlanArtifact,
          },
          id: taskId,
        });
      } else {
        await A2ATaskModel.updateState(taskId, 'failed');
        return res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal error: delegation flow halted' },
          id: taskId,
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

export default router;
