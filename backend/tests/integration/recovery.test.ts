import request from 'supertest';
import app from '../../src/index.js';
import { db } from '../../src/services/db.service.js';
import { UserModel } from '../../src/models/user.js';
import { WeeklyPlanModel } from '../../src/models/plan.js';
import { LearningSessionModel } from '../../src/models/session.js';
import { checkMissedSessions } from '../../src/services/cron.service.js';
import { calendarService } from '../../src/services/calendar.service.js';
import crypto from 'crypto';

describe('Recovery Integration Flow', () => {
  const userId = crypto.randomUUID();
  let planId: string;
  let sessionId: string;

  beforeAll(async () => {
    if (process.env.DATABASE_URL) {
      await db.query('DELETE FROM learning_sessions WHERE plan_id IN (SELECT id FROM weekly_plans WHERE user_id = $1)', [userId]);
      await db.query('DELETE FROM weekly_plans WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    }

    await UserModel.create({ id: userId, email: 'recovery-test@bloom.edu' });
    planId = crypto.randomUUID();
    await WeeklyPlanModel.create({
      id: planId,
      user_id: userId,
      week_start: new Date().toISOString().split('T')[0],
      weekly_goal: 'Recovery test goal',
      flexibility_note: 'Contingency plan',
    });

    // Create session 3 hours in the past
    sessionId = crypto.randomUUID();
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 3);

    const { eventId } = await calendarService.createEvent('Test past topic', pastDate, 45);

    await LearningSessionModel.create({
      id: sessionId,
      plan_id: planId,
      scheduled_at: pastDate,
      duration_minutes: 45,
      topic: 'Test past topic',
      format: 'reading',
      effort_level: 'light',
      status: 'planned',
      calendar_event_id: eventId,
    });
  });

  afterAll(async () => {
    if (process.env.DATABASE_URL) {
      await db.query('DELETE FROM learning_sessions WHERE plan_id IN (SELECT id FROM weekly_plans WHERE user_id = $1)', [userId]);
      await db.query('DELETE FROM weekly_plans WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
      await db.close();
    }
  });

  it('should mark past session as missed via cron, trigger recovery chat, and reschedule session', async () => {
    // 1. Run cron check
    const missedCount = await checkMissedSessions();
    expect(missedCount).toBe(1);

    // Verify session status updated in database
    const sessionsBefore = await LearningSessionModel.findByPlanId(planId);
    const updatedSession = sessionsBefore.find((s) => s.id === sessionId);
    expect(updatedSession?.status).toBe('missed');

    // 2. Start recovery chat
    let res = await request(app)
      .post('/api/chat')
      .send({ userId, message: 'I missed the session', state: 'RECOVERY_INITIATE' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('RECOVERY_EXPLORE');
    expect(res.body.response).toContain('What got in the way');

    // Explore
    res = await request(app)
      .post('/api/chat')
      .send({ userId, message: 'I was too tired after work', state: 'RECOVERY_EXPLORE' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('RECOVERY_RESOLVE');
    expect(res.body.response).toContain('reschedule');

    // Resolve (Yes, confirm)
    res = await request(app)
      .post('/api/chat')
      .send({ userId, message: 'Yes, reschedule please', state: 'RECOVERY_RESOLVE' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('RECOVERY_COMPLETE');
    expect(res.body.response).toContain('tomorrow');

    // Check rescheduling in database
    const sessionsAfter = await LearningSessionModel.findByPlanId(planId);
    const oldSession = sessionsAfter.find((s) => s.id === sessionId);
    expect(oldSession?.status).toBe('rescheduled');

    const newSession = sessionsAfter.find((s) => s.status === 'planned');
    expect(newSession).toBeDefined();
    expect(newSession?.topic).toBe('Test past topic');
  });
});
