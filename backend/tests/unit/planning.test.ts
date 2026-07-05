import { planningAgent } from '../../src/specialists/planning.agent.js';
import { llmService } from '../../src/services/llm.service.js';
import { calendarService } from '../../src/services/calendar.service.js';

jest.mock('../../src/services/llm.service.js', () => ({
  llmService: {
    getProvider: jest.fn().mockReturnValue('mock'),
    generateWithTools: jest.fn(),
  },
}));

jest.mock('../../src/services/calendar.service.js', () => ({
  calendarService: {
    getFreeBusy: jest.fn().mockResolvedValue([]),
    listUpcoming: jest.fn().mockResolvedValue([]),
    createEvent: jest.fn().mockResolvedValue({ eventId: 'evt-mock-123', synced: true }),
  },
}));

describe('PlanningAgent Unit Tests', () => {
  const profile = {
    primary_goal: 'Swahili language',
    weekly_time_budget_hours: 4,
    best_time: 'evening',
  };

  const dateContext = { isoDate: '2026-07-05', timezone: 'UTC', weekdayName: 'Sunday' };

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-apply default calendar mock implementations after clearAllMocks
    (calendarService.getFreeBusy as jest.Mock).mockResolvedValue([]);
    (calendarService.listUpcoming as jest.Mock).mockResolvedValue([]);
    (calendarService.createEvent as jest.Mock).mockResolvedValue({ eventId: 'evt-mock-123', synced: true });
  });

  it('should return a plain-text suggestion without confirming when LLM returns text', async () => {
    (llmService.generateWithTools as jest.Mock).mockResolvedValue({
      type: 'text',
      content: 'Here are a couple of options for your Swahili language sessions this week.'
    });

    const result = await planningAgent.processTurn('suggest plans', profile, [], '', dateContext);

    expect(result.confirmed).toBe(false);
    expect(result.response).toContain('Swahili language');
    expect(result.proposedPlan).toBeUndefined();
    expect(llmService.generateWithTools).toHaveBeenCalledTimes(1);
  });

  it('should confirm plan and populate proposedPlan with calendar_event_id when confirm_plan tool is called', async () => {
    const futureSessions = [
      { title: 'Swahili session 1', scheduled_at: '2026-07-10T19:00:00', duration_minutes: 60 },
      { title: 'Swahili session 2', scheduled_at: '2026-07-12T19:00:00', duration_minutes: 60 },
    ];

    (llmService.generateWithTools as jest.Mock)
      .mockResolvedValueOnce({ type: 'tool_call', id: 'call-1', name: 'get_free_busy', args: {} })
      .mockResolvedValueOnce({
        type: 'tool_call',
        id: 'call-2',
        name: 'confirm_plan',
        args: { weekly_goal: 'Complete Swahili study', sessions: futureSessions }
      });

    const result = await planningAgent.processTurn('Yes, confirm that', profile, [], '', dateContext);

    expect(result.confirmed).toBe(true);
    expect(result.proposedPlan).toBeDefined();
    expect(result.proposedPlan!.weekly_goal).toBe('Complete Swahili study');
    expect(result.proposedPlan!.sessions).toHaveLength(2);
    expect(result.proposedPlan!.sessions[0].calendar_event_id).toBe('evt-mock-123');
    expect(calendarService.createEvent).toHaveBeenCalledTimes(2);
  });

  it('records per-session sync outcome on proposedPlan when some sessions fail to sync (spec 002-calendar-sync-confirmation)', async () => {
    const futureSessions = [
      { title: 'Swahili session 1', scheduled_at: '2026-07-10T19:00:00', duration_minutes: 60 },
      { title: 'Swahili session 2', scheduled_at: '2026-07-12T19:00:00', duration_minutes: 60 },
    ];

    (calendarService.createEvent as jest.Mock)
      .mockResolvedValueOnce({ eventId: 'evt-synced', synced: true })
      .mockResolvedValueOnce({ eventId: 'evt-local-fallback', synced: false });

    (llmService.generateWithTools as jest.Mock)
      .mockResolvedValueOnce({ type: 'tool_call', id: 'call-1', name: 'get_free_busy', args: {} })
      .mockResolvedValueOnce({
        type: 'tool_call',
        id: 'call-2',
        name: 'confirm_plan',
        args: { weekly_goal: 'Complete Swahili study', sessions: futureSessions }
      });

    const result = await planningAgent.processTurn('Yes, confirm that', profile, [], '', dateContext);

    expect(result.proposedPlan!.sessions[0].synced).toBe(true);
    expect(result.proposedPlan!.sessions[1].synced).toBe(false);
  });

  it('should pass get_free_busy tool result back to LLM in the next iteration', async () => {
    const mockSlots = [{ start: '2026-07-07T08:00:00.000Z', end: '2026-07-07T08:30:00.000Z', available: true }];
    (calendarService.getFreeBusy as jest.Mock).mockResolvedValue(mockSlots);

    (llmService.generateWithTools as jest.Mock)
      .mockResolvedValueOnce({ type: 'tool_call', id: 'call-1', name: 'get_free_busy', args: {} })
      .mockResolvedValueOnce({ type: 'text', content: 'How about Tuesday evening?' });

    const result = await planningAgent.processTurn('What times work?', profile, [], '', dateContext);

    expect(result.confirmed).toBe(false);
    expect(result.response).toBe('How about Tuesday evening?');

    // Second generateWithTools call should include the tool result in messages
    const secondCall = (llmService.generateWithTools as jest.Mock).mock.calls[1];
    const secondMessages = secondCall[1];
    expect(secondMessages.some((m: any) => m.role === 'tool')).toBe(true);
  });

  it('should return a fallback response if loop exhausts without text or confirm_plan', async () => {
    (llmService.generateWithTools as jest.Mock).mockResolvedValue({
      type: 'tool_call',
      id: 'loop-call',
      name: 'list_upcoming',
      args: {}
    });

    const result = await planningAgent.processTurn('help me plan', profile, [], '', dateContext);

    expect(result.confirmed).toBe(false);
    expect(result.response).toBeTruthy();
    expect(llmService.generateWithTools).toHaveBeenCalledTimes(5);
  });
});

describe('PlanningAgent date grounding (spec 001-schedule-suggestion-accuracy)', () => {
  const profile = {
    primary_goal: 'Swahili language',
    weekly_time_budget_hours: 4,
    best_time: 'evening',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (llmService.generateWithTools as jest.Mock).mockResolvedValue({
      type: 'text',
      content: 'Here are a couple of options for your Swahili language sessions this week.'
    });
  });

  it('grounds the system prompt in the real current date instead of leaving it unspecified', async () => {
    const sunday = { isoDate: '2026-07-05', timezone: 'America/Sao_Paulo', weekdayName: 'Sunday' };

    await planningAgent.processTurn('how about tomorrow?', profile, [], '', sunday);

    const systemPrompt = (llmService.generateWithTools as jest.Mock).mock.calls[0][0];
    expect(systemPrompt).toContain('Sunday, 2026-07-05');
    expect(systemPrompt).not.toContain('{today}');
  });

  it('resolves a different date entirely when the current date changes, proving it is not hardcoded', async () => {
    const monday = { isoDate: '2026-07-06', timezone: 'America/Sao_Paulo', weekdayName: 'Monday' };

    await planningAgent.processTurn('how about today?', profile, [], '', monday);

    const systemPrompt = (llmService.generateWithTools as jest.Mock).mock.calls[0][0];
    expect(systemPrompt).toContain('Monday, 2026-07-06');
    expect(systemPrompt).not.toContain('Sunday, 2026-07-05');
  });
});

describe('PlanningAgent preference presence (spec 001-schedule-suggestion-accuracy)', () => {
  const dateContext = { isoDate: '2026-07-05', timezone: 'UTC', weekdayName: 'Sunday' };

  beforeEach(() => {
    jest.clearAllMocks();
    (llmService.generateWithTools as jest.Mock).mockResolvedValue({
      type: 'text',
      content: 'Let me ask a couple of questions first.'
    });
  });

  it('uses the learner\'s stored preferences rather than the old hardcoded defaults', async () => {
    const profile = {
      primary_goal: 'Coding skill',
      weekly_time_budget_hours: 8,
      best_time: 'morning',
    };

    await planningAgent.processTurn('suggest a plan', profile, [], '', dateContext);

    const systemPrompt = (llmService.generateWithTools as jest.Mock).mock.calls[0][0];
    expect(systemPrompt).toMatch(/Weekly time budget: 8 hours/);
    expect(systemPrompt).toMatch(/Best focus time: morning/);
    expect(systemPrompt).not.toMatch(/Weekly time budget: 5 hours/);
    expect(systemPrompt).not.toMatch(/Best focus time: evening/);
  });

  it('asks instead of assuming when the learner has no stored profile yet', async () => {
    await planningAgent.processTurn('suggest a plan', null, [], '', dateContext);

    const systemPrompt = (llmService.generateWithTools as jest.Mock).mock.calls[0][0];
    expect(systemPrompt).toContain('not yet set');
    expect(systemPrompt).not.toMatch(/Weekly time budget: 5 hours/);
    expect(systemPrompt).not.toMatch(/Best focus time: evening/);
  });

  it('prefers a preference stated earlier in the current conversation over an older stored value', async () => {
    const profile = {
      primary_goal: 'Coding skill',
      weekly_time_budget_hours: 5,
      best_time: 'evening',
    };
    const planningHistory = [
      { role: 'user', content: 'Actually, let\'s do 10 hours a week instead, and mornings work better for me now.' },
      { role: 'coach', content: 'Got it — updating that.' },
    ];

    await planningAgent.processTurn('suggest a plan', profile, planningHistory, '', dateContext);

    const systemPrompt = (llmService.generateWithTools as jest.Mock).mock.calls[0][0];
    expect(systemPrompt).toMatch(/Weekly time budget: 10 hours/);
    expect(systemPrompt).toMatch(/Best focus time: morning/);
    expect(systemPrompt).not.toMatch(/Weekly time budget: 5 hours/);
    expect(systemPrompt).not.toMatch(/Best focus time: evening/);
  });
});
