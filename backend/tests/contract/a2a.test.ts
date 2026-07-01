import request from 'supertest';
import app from '../../src/index.js';
import { db } from '../../src/services/db.service.js';
import { UserModel } from '../../src/models/user.js';
import { LearnerProfileModel } from '../../src/models/profile.js';
import crypto from 'crypto';

describe('A2A Contract Tests', () => {
  const userId = crypto.randomUUID();

  beforeAll(async () => {
    if (process.env.DATABASE_URL) {
      await db.query('DELETE FROM learning_sessions WHERE plan_id IN (SELECT id FROM weekly_plans WHERE user_id = $1)', [userId]);
      await db.query('DELETE FROM weekly_plans WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM learner_profiles WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    }

    await UserModel.create({ id: userId, email: 'a2a-test@bloom.edu' });
    await LearnerProfileModel.create({
      id: crypto.randomUUID(),
      user_id: userId,
      primary_goal: 'A2A testing goals',
      goal_category: 'technical',
      motivation_reasons: ['integration'],
      past_attempts: [],
      barriers: [],
      weekly_time_budget_hours: 6,
      best_time: 'evening',
      preferred_formats: ['practice'],
      confidence_score: 9,
      readiness_stage: 'action',
      success_definition: 'Signed artifact',
    });
  });

  afterAll(async () => {
    if (process.env.DATABASE_URL) {
      await db.query('DELETE FROM learning_sessions WHERE plan_id IN (SELECT id FROM weekly_plans WHERE user_id = $1)', [userId]);
      await db.query('DELETE FROM weekly_plans WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM learner_profiles WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
      await db.close();
    }
  });

  it('should fetch signed agent card successfully', async () => {
    const res = await request(app).get('/.well-known/agent.json');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('bloom-coaching-agent');
    expect(res.body.skills.length).toBe(3);
  });

  it('should reject unauthorized request without bearer token', async () => {
    const res = await request(app)
      .post('/api/a2a')
      .send({
        jsonrpc: '2.0',
        method: 'tasks/send',
        params: {
          id: crypto.randomUUID(),
          message: {
            role: 'user',
            parts: [{ type: 'data', data: { skill_id: 'plan_week', user_id: userId } }],
          },
        },
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Missing bearer token');
  });

  it('should execute and complete task with valid mock-token', async () => {
    const taskId = crypto.randomUUID();
    const res = await request(app)
      .post('/api/a2a')
      .set('Authorization', 'Bearer mock-token')
      .send({
        jsonrpc: '2.0',
        method: 'tasks/send',
        params: {
          id: taskId,
          message: {
            role: 'user',
            parts: [{ type: 'data', data: { skill_id: 'plan_week', user_id: userId } }],
          },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.jsonrpc).toBe('2.0');
    expect(res.body.result.state).toBe('completed');
    expect(res.body.result.artifact.name).toBe('weekly_plan');
  });
});
