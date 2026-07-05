import { CoordinatorService } from '../../src/coordinator/coordinator.service.js';
import { llmService } from '../../src/services/llm.service.js';
import { LearnerProfileModel } from '../../src/models/profile.js';
import { planningAgent } from '../../src/specialists/planning.agent.js';
import { onboardingAgent } from '../../src/specialists/onboarding.agent.js';
import { recoveryAgent } from '../../src/specialists/recovery.agent.js';
import { reflectionAgent } from '../../src/specialists/reflection.agent.js';

jest.mock('../../src/services/llm.service.js', () => ({
  llmService: {
    getProvider: jest.fn().mockReturnValue('mock'),
    generateWithTools: jest.fn(),
  },
}));

jest.mock('../../src/services/calendar.service.js', () => ({
  calendarService: {
    createEvent: jest.fn().mockResolvedValue({ eventId: 'evt-coord-123', synced: true }),
    deleteEvent: jest.fn().mockResolvedValue(true),
    getFreeBusy: jest.fn().mockResolvedValue([]),
    listUpcoming: jest.fn().mockResolvedValue([]),
    getEvents: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../src/models/profile.js', () => ({
  LearnerProfileModel: {
    findByUserId: jest.fn().mockResolvedValue({
      primary_goal: 'Test goal',
      weekly_time_budget_hours: 4,
      best_time: 'evening',
    }),
    create: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/models/plan.js', () => ({
  WeeklyPlanModel: { create: jest.fn().mockResolvedValue(undefined), findLatestByUserId: jest.fn().mockResolvedValue(null) },
}));

jest.mock('../../src/models/session.js', () => ({
  LearningSessionModel: { create: jest.fn().mockResolvedValue(undefined), findByPlanId: jest.fn().mockResolvedValue([]), updateStatus: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../src/models/reflection.js', () => ({
  ReflectionEntryModel: { create: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../src/specialists/planning.agent.js', () => ({
  planningAgent: {
    processTurn: jest.fn(),
  },
}));

jest.mock('../../src/specialists/onboarding.agent.js', () => ({
  onboardingAgent: {
    executeTurn: jest.fn().mockResolvedValue({ response: 'Onboarding response', nextState: 'ONBOARDING_S2', slotsFilled: {} }),
  },
}));

jest.mock('../../src/specialists/recovery.agent.js', () => ({
  recoveryAgent: {
    processTurn: jest.fn().mockResolvedValue({ response: 'Recovery response', nextStage: 'EXPLORE', rescheduleNeeded: false }),
  },
}));

jest.mock('../../src/specialists/reflection.agent.js', () => ({
  reflectionAgent: {
    generatePrompt: jest.fn().mockResolvedValue('Reflection prompt'),
    processResponse: jest.fn().mockResolvedValue({ text: 'Great session', skipped: false }),
  },
}));

describe('CoordinatorService Unit Tests', () => {
  let coordinator: CoordinatorService;

  beforeEach(() => {
    jest.clearAllMocks();
    coordinator = new CoordinatorService();
  });

  it('should delegate to planning agent when in PLANNING state and forward specialist response', async () => {
    (planningAgent.processTurn as jest.Mock).mockResolvedValue({
      response: 'Here are your planning options.',
      confirmed: false,
    });

    (llmService.generateWithTools as jest.Mock)
      .mockResolvedValueOnce({ type: 'tool_call', id: 'c1', name: 'delegate', args: { agent: 'planning', reason: 'User is in planning' } })
      .mockResolvedValueOnce({ type: 'tool_call', id: 'c2', name: 'respond', args: { message: 'Here are your planning options.', new_state: 'PLANNING' } });

    const result = await coordinator.processMessage('user-123', 'help me plan', {
      userId: 'user-123',
      currentState: 'PLANNING',
      lastMessages: []
    });

    expect(result.responseToUser).toBe('Here are your planning options.');
    expect(result.newState).toBe('PLANNING');
    expect(planningAgent.processTurn).toHaveBeenCalledTimes(1);
  });

  it('should transition to ACTIVE_WEEK when planning agent confirms plan', async () => {
    const futureSessions = [
      { title: 'Session 1', scheduled_at: new Date('2026-07-10T19:00:00'), duration_minutes: 60, topic: 'Session 1', format: 'practice', effort_level: 'moderate', calendar_event_id: 'evt-1', synced: true },
    ];

    (planningAgent.processTurn as jest.Mock).mockResolvedValue({
      response: 'Plan confirmed!',
      confirmed: true,
      proposedPlan: { weekly_goal: 'Weekly test goal', sessions: futureSessions }
    });

    (llmService.generateWithTools as jest.Mock)
      .mockResolvedValueOnce({ type: 'tool_call', id: 'c1', name: 'delegate', args: { agent: 'planning', reason: 'Planning' } })
      .mockResolvedValueOnce({ type: 'tool_call', id: 'c2', name: 'respond', args: { message: 'Plan confirmed!', new_state: 'ACTIVE_WEEK' } });

    const result = await coordinator.processMessage('user-456', 'yes confirm', {
      userId: 'user-456',
      currentState: 'PLANNING',
      lastMessages: []
    });

    expect(result.newState).toBe('ACTIVE_WEEK');
  });

  it('carries a calendarSync summary with syncedCount below totalSessions when some sessions fail to sync (spec 002-calendar-sync-confirmation)', async () => {
    const mixedSyncSessions = [
      { title: 'Session 1', scheduled_at: new Date('2026-07-10T19:00:00'), duration_minutes: 60, topic: 'Session 1', format: 'practice', effort_level: 'moderate', calendar_event_id: 'evt-1', synced: true },
      { title: 'Session 2', scheduled_at: new Date('2026-07-12T19:00:00'), duration_minutes: 60, topic: 'Session 2', format: 'practice', effort_level: 'moderate', calendar_event_id: 'evt-2', synced: false },
    ];

    (planningAgent.processTurn as jest.Mock).mockResolvedValue({
      response: 'Plan confirmed!',
      confirmed: true,
      proposedPlan: { weekly_goal: 'Weekly test goal', sessions: mixedSyncSessions }
    });

    (llmService.generateWithTools as jest.Mock)
      .mockResolvedValueOnce({ type: 'tool_call', id: 'c1', name: 'delegate', args: { agent: 'planning', reason: 'Planning' } })
      .mockResolvedValueOnce({ type: 'tool_call', id: 'c2', name: 'respond', args: { message: 'Plan confirmed!', new_state: 'ACTIVE_WEEK' } });

    const result = await coordinator.processMessage('user-mixed', 'yes confirm', {
      userId: 'user-mixed',
      currentState: 'PLANNING',
      lastMessages: []
    });

    expect(result.calendarSync).toBeDefined();
    expect(result.calendarSync!.totalSessions).toBe(2);
    expect(result.calendarSync!.syncedCount).toBe(1);
    expect(result.calendarSync!.syncedCount).toBeLessThan(result.calendarSync!.totalSessions);
  });

  it('should respond directly without delegation when coordinator LLM calls respond tool', async () => {
    (llmService.generateWithTools as jest.Mock).mockResolvedValueOnce({
      type: 'tool_call',
      id: 'c1',
      name: 'respond',
      args: { message: 'Let me know what you need.', new_state: 'ACTIVE_WEEK' }
    });

    const result = await coordinator.processMessage('user-789', 'what is the weather?', {
      userId: 'user-789',
      currentState: 'ACTIVE_WEEK',
      lastMessages: []
    });

    expect(result.responseToUser).toBe('Let me know what you need.');
    expect(planningAgent.processTurn).not.toHaveBeenCalled();
  });

  it('should pass safety filter and replace flagged responses', async () => {
    (llmService.generateWithTools as jest.Mock).mockResolvedValueOnce({
      type: 'text',
      content: 'You should have just done the work — why did you miss it?'
    });

    const result = await coordinator.processMessage('user-000', 'I skipped again', {
      userId: 'user-000',
      currentState: 'ACTIVE_WEEK',
      lastMessages: []
    });

    expect(result.safetyCheckPassed).toBe(false);
    expect(result.responseToUser).toContain('sustainable rhythm');
  });

  it('does not fabricate profile fields the learner never provided when onboarding completes (spec 003-onboarding-stage-completeness)', async () => {
    (onboardingAgent.executeTurn as jest.Mock).mockResolvedValue({
      response: 'Your learner profile is confirmed.',
      nextState: 'PLANNING',
      slotsFilled: {},
    });

    (llmService.generateWithTools as jest.Mock)
      .mockResolvedValueOnce({ type: 'tool_call', id: 'c1', name: 'delegate', args: { agent: 'onboarding', reason: 'Onboarding' } })
      .mockResolvedValueOnce({ type: 'tool_call', id: 'c2', name: 'respond', args: { message: 'Your learner profile is confirmed.', new_state: 'PLANNING' } });

    await coordinator.processMessage('user-nofab', 'yes, confirm', {
      userId: 'user-nofab',
      currentState: 'ONBOARDING_S6',
      lastMessages: []
    });

    expect(LearnerProfileModel.create).toHaveBeenCalledWith(expect.objectContaining({
      weekly_time_budget_hours: null,
      best_time: null,
      confidence_score: null,
      readiness_stage: 'preparation',
      goal_category: 'general',
      preferred_formats: ['flexible'],
    }));
  });

  it('routes to the correct specialist even when the model chooses a different one for a mapped state (spec 004-coordinator-routing-guard)', async () => {
    (onboardingAgent.executeTurn as jest.Mock).mockResolvedValue({
      response: 'Great, your profile is confirmed.',
      nextState: 'PLANNING',
      slotsFilled: {},
    });

    (llmService.generateWithTools as jest.Mock)
      .mockResolvedValueOnce({ type: 'tool_call', id: 'c1', name: 'delegate', args: { agent: 'planning', reason: 'Model mistakenly picked planning' } });

    const result = await coordinator.processMessage('user-guard-1', 'yes confirm', {
      userId: 'user-guard-1',
      currentState: 'ONBOARDING_S6',
      lastMessages: []
    });

    expect(onboardingAgent.executeTurn).toHaveBeenCalledTimes(1);
    expect(planningAgent.processTurn).not.toHaveBeenCalled();
    expect(result.responseToUser).toBe('Great, your profile is confirmed.');
    expect(result.newState).toBe('PLANNING');
  });

  it('routes to the correct specialist when the model bypasses delegation entirely for a mapped state (spec 004-coordinator-routing-guard)', async () => {
    (onboardingAgent.executeTurn as jest.Mock).mockResolvedValue({
      response: 'Great, your profile is confirmed.',
      nextState: 'PLANNING',
      slotsFilled: {},
    });

    (llmService.generateWithTools as jest.Mock)
      .mockResolvedValueOnce({ type: 'text', content: 'Sounds good!' });

    const result = await coordinator.processMessage('user-guard-2', 'yes confirm', {
      userId: 'user-guard-2',
      currentState: 'ONBOARDING_S6',
      lastMessages: []
    });

    expect(onboardingAgent.executeTurn).toHaveBeenCalledTimes(1);
    expect(result.responseToUser).toBe('Great, your profile is confirmed.');
    expect(result.newState).toBe('PLANNING');
  });

  it('does not override ACTIVE_WEEK routing when delegating to reflection for an on-topic message (spec 004-coordinator-routing-guard)', async () => {
    (reflectionAgent.generatePrompt as jest.Mock).mockResolvedValue('Reflection prompt');
    (llmService.generateWithTools as jest.Mock)
      .mockResolvedValueOnce({ type: 'tool_call', id: 'c1', name: 'delegate', args: { agent: 'reflection', reason: 'Session finished' } });

    const result = await coordinator.processMessage('user-active-1', 'I finished my session', {
      userId: 'user-active-1',
      currentState: 'ACTIVE_WEEK',
      lastMessages: []
    });

    expect(result.responseToUser).toBe('Reflection prompt');
    expect(result.newState).toBe('REFLECTION');
  });

  it('does not override ACTIVE_WEEK routing when responding directly to an off-topic message (spec 004-coordinator-routing-guard)', async () => {
    (llmService.generateWithTools as jest.Mock)
      .mockResolvedValueOnce({ type: 'tool_call', id: 'c1', name: 'respond', args: { message: "Let's stay focused on your learning goal!", new_state: 'ACTIVE_WEEK' } });

    const result = await coordinator.processMessage('user-active-2', 'what is the weather today?', {
      userId: 'user-active-2',
      currentState: 'ACTIVE_WEEK',
      lastMessages: []
    });

    expect(result.responseToUser).toBe("Let's stay focused on your learning goal!");
    expect(result.newState).toBe('ACTIVE_WEEK');
    expect(planningAgent.processTurn).not.toHaveBeenCalled();
    expect(onboardingAgent.executeTurn).not.toHaveBeenCalled();
  });

  it('does not override the cascade delegation from recovery to reflection on the second iteration (spec 004-coordinator-routing-guard)', async () => {
    (recoveryAgent.processTurn as jest.Mock).mockResolvedValue({
      response: 'Recovery response',
      nextStage: 'ACTIVE_WEEK',
      rescheduleNeeded: false,
    });
    (reflectionAgent.generatePrompt as jest.Mock).mockResolvedValue('Reflection prompt');
    (reflectionAgent.processResponse as jest.Mock).mockResolvedValue({ text: 'Great session', skipped: false });

    (llmService.generateWithTools as jest.Mock)
      .mockResolvedValueOnce({ type: 'tool_call', id: 'c1', name: 'delegate', args: { agent: 'recovery', reason: 'Recovery state' } })
      .mockResolvedValueOnce({ type: 'tool_call', id: 'c2', name: 'delegate', args: { agent: 'reflection', reason: 'Cascade to reflection' } });

    const result = await coordinator.processMessage('user-cascade-1', 'I missed my session', {
      userId: 'user-cascade-1',
      currentState: 'RECOVERY_INITIATE',
      lastMessages: []
    });

    expect(reflectionAgent.processResponse).toHaveBeenCalled();
    expect(result.newState).toBe('ACTIVE_WEEK');
  });
});
