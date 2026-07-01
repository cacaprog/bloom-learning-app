import request from 'supertest';
import app from '../../src/index.js';
import { db } from '../../src/services/db.service.js';
import crypto from 'crypto';

describe('Onboarding Integration Flow', () => {
  const userId = crypto.randomUUID();

  beforeAll(async () => {
    // If DATABASE_URL is set, we run a query to clear test user data
    if (process.env.DATABASE_URL) {
      await db.query('DELETE FROM learner_profiles WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });

  afterAll(async () => {
    if (process.env.DATABASE_URL) {
      await db.query('DELETE FROM learner_profiles WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
      await db.close();
    }
  });

  it('should walk through the S1-S6 onboarding conversation and save profile', async () => {
    // Turn 1: Welcome
    let res = await request(app)
      .post('/api/chat')
      .send({ userId, message: 'Start onboarding', state: 'ONBOARDING_S1' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('ONBOARDING_S2');
    expect(res.body.response).toContain('What skill are you looking to learn');

    // Turn 2: Goal Discovery
    res = await request(app)
      .post('/api/chat')
      .send({ userId, message: 'I want to learn technical programming', state: 'ONBOARDING_S2' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('ONBOARDING_S3');
    expect(res.body.response).toContain('Have you tried learning this before');

    // Turn 3: History & Barriers
    res = await request(app)
      .post('/api/chat')
      .send({ userId, message: 'Yes, tried books but got stuck due to time constraints', state: 'ONBOARDING_S3' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('ONBOARDING_S4');
    expect(res.body.response).toContain('How many hours a week');

    // Turn 4: Context & Resources
    res = await request(app)
      .post('/api/chat')
      .send({ userId, message: 'I can spend 10 hours on evenings', state: 'ONBOARDING_S4' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('ONBOARDING_S5');
    expect(res.body.response).toContain('confident');

    // Turn 5: Readiness Check
    res = await request(app)
      .post('/api/chat')
      .send({ userId, message: 'Confidence is 8', state: 'ONBOARDING_S5' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('ONBOARDING_S6');
    expect(res.body.response).toContain('confirm this outline');

    // Turn 6: Confirm
    res = await request(app)
      .post('/api/chat')
      .send({ userId, message: 'Yes, confirm', state: 'ONBOARDING_S6' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('PLANNING');
    expect(res.body.response).toContain('confirmed');
  });
});
