import request from 'supertest';
import app from '../../src/index.js';
import { db } from '../../src/services/db.service.js';
import { UserModel } from '../../src/models/user.js';
import { ReflectionEntryModel } from '../../src/models/reflection.js';
import crypto from 'crypto';

describe('Reflection Agent Integration Flow', () => {
  const userId = crypto.randomUUID();

  beforeAll(async () => {
    if (process.env.DATABASE_URL) {
      await db.query('DELETE FROM reflection_entries WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    }
    await UserModel.create({ id: userId, email: 'reflect-test@bloom.edu' });
  });

  afterAll(async () => {
    if (process.env.DATABASE_URL) {
      await db.query('DELETE FROM reflection_entries WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
      await db.close();
    }
  });

  it('should trigger prompt, submit reflection response, and persist in db', async () => {
    // 1. Trigger session reflection prompt
    let res = await request(app)
      .post('/api/chat')
      .send({ userId, message: 'I finished my learning session!', state: 'REFLECTION' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('REFLECTION');
    expect(res.body.response).toContain('What went well');

    // 2. Submit response text
    res = await request(app)
      .post('/api/chat')
      .send({ userId, message: 'I understood Postgres joins today.', state: 'REFLECTION' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('ACTIVE_WEEK');
    expect(res.body.response).toContain("back on track");

    // 3. Verify database persistence
    const entries = await ReflectionEntryModel.findByUserId(userId);
    expect(entries.length).toBe(1);
    expect(entries[0].response_text).toBe('I understood Postgres joins today.');
    expect(entries[0].skipped).toBe(false);
  });

  it('should support skipping reflection prompts without penalty', async () => {
    // 1. Trigger prompt
    let res = await request(app)
      .post('/api/chat')
      .send({ userId, message: 'I finished my learning session!', state: 'REFLECTION' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('REFLECTION');

    // 2. Send 'skip' message
    res = await request(app)
      .post('/api/chat')
      .send({ userId, message: 'skip', state: 'REFLECTION' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('ACTIVE_WEEK');

    // 3. Verify skipped entry in DB
    const entries = await ReflectionEntryModel.findByUserId(userId);
    const skippedEntry = entries.find((e) => e.skipped === true);
    expect(skippedEntry).toBeDefined();
    expect(skippedEntry?.response_text).toBeNull();
  });
});
