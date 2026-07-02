import { CoachMessageModel } from '../../src/models/message.js';
import { db } from '../../src/services/db.service.js';
import crypto from 'crypto';

describe('CoachMessageModel Unit Tests', () => {
  const userId = crypto.randomUUID();

  beforeEach(async () => {
    // Clear messages for test user
    await CoachMessageModel.deleteByUserId(userId);
  });

  afterAll(async () => {
    await CoachMessageModel.deleteByUserId(userId);
    if (!process.env.DATABASE_URL) {
      // If we are in real db mode, close pools, but db.service handles it
    }
  });

  it('should successfully create and retrieve messages chronologically', async () => {
    const msg1Id = crypto.randomUUID();
    const msg2Id = crypto.randomUUID();

    const msg1 = await CoachMessageModel.create({
      id: msg1Id,
      user_id: userId,
      role: 'user',
      mode: 'chat',
      state: 'ONBOARDING_S1',
      content: 'Hello Coach',
    });

    expect(msg1).toBeDefined();
    expect(msg1.id).toBe(msg1Id);
    expect(msg1.content).toBe('Hello Coach');

    // Wait 5ms to ensure distinct timestamp ordering in memory if sorted by date
    await new Promise((resolve) => setTimeout(resolve, 5));

    const msg2 = await CoachMessageModel.create({
      id: msg2Id,
      user_id: userId,
      role: 'coach',
      mode: 'chat',
      state: 'ONBOARDING_S2',
      content: 'Hello Learner, what is your goal?',
    });

    expect(msg2).toBeDefined();
    expect(msg2.id).toBe(msg2Id);

    // Retrieve history
    const history = await CoachMessageModel.findByUserId(userId);
    expect(history.length).toBe(2);
    expect(history[0].id).toBe(msg1Id);
    expect(history[1].id).toBe(msg2Id);
  });

  it('should successfully delete all messages for a user', async () => {
    const msgId = crypto.randomUUID();
    await CoachMessageModel.create({
      id: msgId,
      user_id: userId,
      role: 'user',
      mode: 'chat',
      state: 'ONBOARDING_S1',
      content: 'Temporary message',
    });

    let history = await CoachMessageModel.findByUserId(userId);
    expect(history.length).toBe(1);

    await CoachMessageModel.deleteByUserId(userId);

    history = await CoachMessageModel.findByUserId(userId);
    expect(history.length).toBe(0);
  });
});
