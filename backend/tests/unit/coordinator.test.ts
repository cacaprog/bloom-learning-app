import { CoordinatorService } from '../../src/coordinator/coordinator.service.js';
import { llmService } from '../../src/services/llm.service.js';
import { LearnerProfileModel } from '../../src/models/profile.js';
import { planningAgent } from '../../src/specialists/planning.agent.js';

jest.mock('../../src/services/llm.service.js', () => ({
  llmService: {
    getProvider: jest.fn().mockReturnValue('mock'),
    generateWithTools: jest.fn(),
  },
}));

jest.mock('../../src/services/calendar.service.js', () => ({
  calendarService: {
    createEvent: jest.fn().mockResolvedValue('evt-coord-123'),
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
      { title: 'Session 1', scheduled_at: new Date('2026-07-10T19:00:00'), duration_minutes: 60, topic: 'Session 1', format: 'practice', effort_level: 'moderate', calendar_event_id: 'evt-1' },
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
});
