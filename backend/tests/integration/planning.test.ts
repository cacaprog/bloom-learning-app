import request from 'supertest';
import app from '../../src/index.js';
import { db } from '../../src/services/db.service.js';
import { UserModel } from '../../src/models/user.js';
import { LearnerProfileModel } from '../../src/models/profile.js';
import { calendarService } from '../../src/services/calendar.service.js';
import { llmService } from '../../src/services/llm.service.js';
import { resolveCurrentDateContext } from '../../src/utils/date.js';
import crypto from 'crypto';

function clearCalendar() {
  (calendarService as any).constructor.clear();
}

describe('Planning Integration Flow', () => {
  const userId = crypto.randomUUID();

  beforeAll(async () => {
    if (process.env.DATABASE_URL) {
      await db.query('DELETE FROM learning_sessions WHERE plan_id IN (SELECT id FROM weekly_plans WHERE user_id = $1)', [userId]);
      await db.query('DELETE FROM weekly_plans WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM learner_profiles WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    }

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

    clearCalendar();
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

  it('should draft and then confirm a weekly plan, syncing events to the calendar', async () => {
    clearCalendar();

    // Propose planning
    let res = await request(app)
      .post('/api/chat')
      .send({ userId, message: 'I want to plan my week', state: 'PLANNING' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('PLANNING');
    expect(res.body.response).toBeTruthy();

    // Confirm planning
    res = await request(app)
      .post('/api/chat')
      .send({ userId, message: 'I confirm Option A', state: 'PLANNING' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('ACTIVE_WEEK');

    // Verify calendar events synced by planning agent's confirm_plan tool
    const events = await calendarService.getEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].title).toContain('Study session');
  });

  it('should include calendarSync with the correct session count when a plan is confirmed via natural agreement (spec 002-calendar-sync-confirmation)', async () => {
    clearCalendar();

    await request(app)
      .post('/api/chat')
      .send({ userId, message: 'I want to plan my week', state: 'PLANNING' });

    const res = await request(app)
      .post('/api/chat')
      .send({ userId, message: 'I confirm Option A', state: 'PLANNING' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('ACTIVE_WEEK');
    expect(res.body.calendarSync).toBeDefined();
    expect(res.body.calendarSync.totalSessions).toBeGreaterThan(0);
    expect(res.body.calendarSync.sessions).toHaveLength(res.body.calendarSync.totalSessions);
  });

  it('should support deterministic plan confirmation via /confirm-plan command bypass', async () => {
    clearCalendar();
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
    expect(res.body.calendarSync).toBeDefined();
    expect(res.body.calendarSync.totalSessions).toBeGreaterThan(0);
    expect(res.body.calendarSync.syncedCount).toBeLessThanOrEqual(res.body.calendarSync.totalSessions);
  });

  it('should schedule sessions when learner confirms after expressing day preferences', async () => {
    clearCalendar();
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

    // Learner expresses preferences
    await request(app)
      .post('/api/chat')
      .send({ userId: testUserId, message: 'I prefer Tuesday and Thursday evenings', state: 'PLANNING' });

    // Learner confirms
    const res = await request(app)
      .post('/api/chat')
      .send({ userId: testUserId, message: 'confirm', state: 'PLANNING' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('ACTIVE_WEEK');

    // Verify that sessions were created (LLM drives exact day selection)
    const events = await calendarService.getEvents();
    expect(events.length).toBeGreaterThan(0);
  });

  it('grounds the planning prompt in the learner\'s own stored timezone and preferences, not server defaults (spec 001-schedule-suggestion-accuracy)', async () => {
    clearCalendar();
    const testUserId = crypto.randomUUID();
    await UserModel.create({ id: testUserId, email: 'timezone-test@bloom.edu', timezone: 'America/Sao_Paulo' });
    await LearnerProfileModel.create({
      id: crypto.randomUUID(),
      user_id: testUserId,
      primary_goal: 'Data structures',
      goal_category: 'technical',
      motivation_reasons: ['career'],
      past_attempts: [],
      barriers: [],
      weekly_time_budget_hours: 10,
      best_time: 'night',
      preferred_formats: ['practice'],
      confidence_score: 7,
      readiness_stage: 'action',
      success_definition: 'Ace interviews',
    });

    const generateWithToolsSpy = jest.spyOn(llmService, 'generateWithTools');

    const res = await request(app)
      .post('/api/chat')
      .send({ userId: testUserId, message: 'suggest a plan', state: 'PLANNING' });

    expect(res.status).toBe(200);

    const expectedDate = resolveCurrentDateContext('America/Sao_Paulo');
    const planningCall = generateWithToolsSpy.mock.calls.find(
      call => typeof call[0] === 'string' && call[0].includes('Planning Specialist Instructions')
    );
    const systemPrompt = planningCall?.[0] as string;

    expect(systemPrompt).toContain(`${expectedDate.weekdayName}, ${expectedDate.isoDate}`);
    expect(systemPrompt).toMatch(/Weekly time budget: 10 hours/);
    expect(systemPrompt).toMatch(/Best focus time: night/);

    generateWithToolsSpy.mockRestore();
  });

  it('does not carry a stale or accumulated calendarSync count across repeated confirmations in the same conversation (spec 002-calendar-sync-confirmation, FR-007)', async () => {
    clearCalendar();
    const testUserId = crypto.randomUUID();
    await UserModel.create({ id: testUserId, email: 'reconfirm-test@bloom.edu' });
    await LearnerProfileModel.create({
      id: crypto.randomUUID(),
      user_id: testUserId,
      primary_goal: 'Piano practice',
      goal_category: 'art',
      motivation_reasons: ['hobby'],
      past_attempts: [],
      barriers: [],
      weekly_time_budget_hours: 4,
      best_time: 'evening',
      preferred_formats: ['practice'],
      confidence_score: 7,
      readiness_stage: 'action',
      success_definition: 'Play a song',
    });

    const firstRes = await request(app)
      .post('/api/chat')
      .send({ userId: testUserId, message: 'confirm', state: 'PLANNING' });

    expect(firstRes.body.calendarSync).toBeDefined();
    const firstTotal = firstRes.body.calendarSync.totalSessions;

    // Re-confirm in the same conversation (client re-sends state: PLANNING)
    const secondRes = await request(app)
      .post('/api/chat')
      .send({ userId: testUserId, message: 'confirm', state: 'PLANNING' });

    expect(secondRes.body.calendarSync).toBeDefined();
    expect(secondRes.body.calendarSync.totalSessions).toBe(firstTotal);
  });
});

