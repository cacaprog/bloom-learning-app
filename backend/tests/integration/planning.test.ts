import request from 'supertest';
import app from '../../src/index.js';
import { db } from '../../src/services/db.service.js';
import { UserModel } from '../../src/models/user.js';
import { LearnerProfileModel } from '../../src/models/profile.js';
import { calendarService } from '../../src/services/calendar.service.js';
import crypto from 'crypto';

describe('Planning Integration Flow', () => {
  const userId = crypto.randomUUID();

  beforeAll(async () => {
    if (process.env.DATABASE_URL) {
      await db.query('DELETE FROM learning_sessions WHERE plan_id IN (SELECT id FROM weekly_plans WHERE user_id = $1)', [userId]);
      await db.query('DELETE FROM weekly_plans WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM learner_profiles WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    }

    // Create user and profile first
    await UserModel.create({ id: userId, email: 'plan-test@bloom.edu' });
    await LearnerProfileModel.create({
      id: crypto.randomUUID(),
      user_id: userId,
      primary_goal: 'Coding skill',
      goal_category: 'technical',
      motivation_reasons: ['job'],
      past_attempts: [],
      barriers: [],
      weekly_time_budget_hours: 6,
      best_time: 'evening',
      preferred_formats: ['practice'],
      confidence_score: 8,
      readiness_stage: 'action',
      success_definition: 'Learn Express',
    });

    CalendarServiceClear();
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

  function CalendarServiceClear() {
    calendarService.deleteEvent('dummy'); // Clear mock storage
  }

  it('should draft and then confirm a weekly plan, syncing events to the calendar', async () => {
    // Propose planning
    let res = await request(app)
      .post('/api/chat')
      .send({ userId, message: 'I want to plan my week', state: 'PLANNING' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('PLANNING');
    expect(res.body.response).toContain('Option A');

    // Confirm planning
    res = await request(app)
      .post('/api/chat')
      .send({ userId, message: 'I confirm Option A', state: 'PLANNING' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('ACTIVE_WEEK');
    expect(res.body.response).toContain('confirmed');

    // Verify calendar events synced
    const events = await calendarService.getEvents();
    expect(events.length).toBe(3);
    expect(events[0].title).toContain('Study session');
  });

  it('should support deterministic plan confirmation via /confirm-plan command bypass', async () => {
    const testUserId = crypto.randomUUID();
    await UserModel.create({ id: testUserId, email: 'command-test@bloom.edu' });
    await LearnerProfileModel.create({
      id: crypto.randomUUID(),
      user_id: testUserId,
      primary_goal: 'Music theory',
      goal_category: 'art',
      motivation_reasons: ['hobby'],
      past_attempts: [],
      barriers: [],
      weekly_time_budget_hours: 3,
      best_time: 'evening',
      preferred_formats: ['practice'],
      confidence_score: 9,
      readiness_stage: 'action',
      success_definition: 'Learn notes',
    });

    const res = await request(app)
      .post('/api/chat')
      .send({ userId: testUserId, message: '/confirm-plan', state: 'PLANNING' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('ACTIVE_WEEK');
    expect(res.body.response).toContain('confirmed');
  });

  it('should respect preferred days (e.g., tues/thurs) and schedule exactly those days', async () => {
    (calendarService.constructor as any).clear(); // Clear mock calendar storage
    const testUserId = crypto.randomUUID();
    await UserModel.create({ id: testUserId, email: 'days-test@bloom.edu' });
    await LearnerProfileModel.create({
      id: crypto.randomUUID(),
      user_id: testUserId,
      primary_goal: 'TypeScript and Data Science',
      goal_category: 'technical',
      motivation_reasons: ['career'],
      past_attempts: [],
      barriers: [],
      weekly_time_budget_hours: 6,
      best_time: 'evening',
      preferred_formats: ['practice'],
      confidence_score: 9,
      readiness_stage: 'action',
      success_definition: 'Consistency',
    });

    // Populate history with user specifying Tuesday and Thursday evenings
    await request(app)
      .post('/api/chat')
      .send({ userId: testUserId, message: '6 hours - tues/thurs evenings', state: 'ONBOARDING_S3' });

    // Try to trigger planning draft
    let res = await request(app)
      .post('/api/chat')
      .send({ userId: testUserId, message: 'Let us start co-creating the plan', state: 'PLANNING' });

    expect(res.status).toBe(200);

    // Confirm plan
    res = await request(app)
      .post('/api/chat')
      .send({ userId: testUserId, message: 'confirm', state: 'PLANNING' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('ACTIVE_WEEK');

    // Retrieve events from calendarService
    const events = await calendarService.getEvents();
    expect(events.length).toBe(2);
    
    const day1 = new Date(events[0].start).getDay(); // Tuesday (2) or Thursday (4)
    const day2 = new Date(events[1].start).getDay();

    expect([2, 4]).toContain(day1);
    expect([2, 4]).toContain(day2);
    expect(day1).not.toBe(day2);
  });
});
