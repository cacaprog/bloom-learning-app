import { planningAgent } from '../../src/specialists/planning.agent.js';
import { llmService } from '../../src/services/llm.service.js';

jest.mock('../../src/services/llm.service.js', () => {
  return {
    llmService: {
      getProvider: jest.fn().mockReturnValue('mock'),
      generate: jest.fn(),
    },
  };
});

describe('PlanningAgent Unit Tests', () => {
  const profile = {
    primary_goal: 'Swahili language',
    weekly_time_budget_hours: 4,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should format mock JSON responses correctly without confirming', async () => {
    (llmService.getProvider as jest.Mock).mockReturnValue('mock');
    const result = await planningAgent.processTurn('suggest plans', profile, []);
    expect(result.confirmed).toBe(false);
    expect(result.response).toContain('Swahili language');
  });

  it('should format mock JSON responses correctly on confirmation', async () => {
    (llmService.getProvider as jest.Mock).mockReturnValue('mock');
    const result = await planningAgent.processTurn('I confirm Option A', profile, []);
    expect(result.confirmed).toBe(true);
    expect(result.response).toContain('Excellent!');
    expect(result.proposedPlan?.weekly_goal).toContain('Swahili language');
    expect(result.proposedPlan?.sessions[0].topic).toContain('Swahili language');
  });

  it('should parse LLM JSON responses correctly', async () => {
    (llmService.getProvider as jest.Mock).mockReturnValue('openai');
    (llmService.generate as jest.Mock).mockResolvedValue(JSON.stringify({
      response: 'Custom LLM generated planning options',
      confirmed: false,
    }));

    const result = await planningAgent.processTurn('suggest plans', profile, []);
    expect(result.confirmed).toBe(false);
    expect(result.response).toBe('Custom LLM generated planning options');
  });

  it('should fall back to raw response text and keyword matching when LLM output is malformed', async () => {
    (llmService.getProvider as jest.Mock).mockReturnValue('openai');
    // Return non-JSON raw text
    (llmService.generate as jest.Mock).mockResolvedValue('Plain text response from LLM');

    const result = await planningAgent.processTurn('suggest plans', profile, []);
    expect(result.confirmed).toBe(false);
    expect(result.response).toBe('Plain text response from LLM');

    const resultConfirm = await planningAgent.processTurn('confirm', profile, []);
    expect(resultConfirm.confirmed).toBe(true);
    expect(resultConfirm.response).toBe('Plain text response from LLM');
  });

  it('should clean and parse LLM JSON responses wrapped in markdown code blocks', async () => {
    (llmService.getProvider as jest.Mock).mockReturnValue('openai');
    (llmService.generate as jest.Mock).mockResolvedValue(
      '```json\n{\n  "response": "Custom cleaned LLM response",\n  "confirmed": false\n}\n```'
    );

    const result = await planningAgent.processTurn('suggest plans', profile, []);
    expect(result.confirmed).toBe(false);
    expect(result.response).toBe('Custom cleaned LLM response');
  });
});
