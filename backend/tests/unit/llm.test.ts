import { llmService } from '../../src/services/llm.service.js';

describe('LlmService Unit Tests', () => {
  let originalGeminiKey: string | undefined;
  let originalOpenaiKey: string | undefined;

  beforeAll(() => {
    originalGeminiKey = process.env.GEMINI_API_KEY;
    originalOpenaiKey = process.env.OPENAI_API_KEY;
  });

  afterAll(() => {
    process.env.GEMINI_API_KEY = originalGeminiKey;
    process.env.OPENAI_API_KEY = originalOpenaiKey;
  });

  it('should resolve mock provider when no keys are supplied', () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    expect(llmService.getProvider()).toBe('mock');
  });

  it('should resolve gemini provider when GEMINI_API_KEY is supplied', () => {
    process.env.GEMINI_API_KEY = 'real-gemini-key-example';
    delete process.env.OPENAI_API_KEY;

    expect(llmService.getProvider()).toBe('gemini');
  });

  it('should resolve openai provider when OPENAI_API_KEY is supplied', () => {
    delete process.env.GEMINI_API_KEY;
    process.env.OPENAI_API_KEY = 'real-openai-key-example';

    expect(llmService.getProvider()).toBe('openai');
  });

  it('should fallback to mock response text in mock mode', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const reply = await llmService.generate('reflection', 'Hello');
    expect(reply).toContain('What went well in this session');
  });

  describe('generateWithTools', () => {
    beforeEach(() => {
      delete process.env.GEMINI_API_KEY;
      delete process.env.OPENAI_API_KEY;
    });

    it('should return a tool_call for planning tools when message contains confirmation keyword', async () => {
      const tools = [
        { name: 'get_free_busy', description: 'Check availability', parameters: { type: 'object', properties: {} } },
        { name: 'confirm_plan', description: 'Confirm sessions', parameters: { type: 'object', properties: {} } },
      ];
      const messages = [{ role: 'user' as const, content: 'yes, confirm that plan' }];

      const result = await llmService.generateWithTools('System prompt', messages, tools);

      expect(result.type).toBe('tool_call');
      expect(result).toHaveProperty('name');
    });

    it('should return text response for planning tools when no confirmation keyword', async () => {
      const tools = [
        { name: 'get_free_busy', description: 'Check availability', parameters: { type: 'object', properties: {} } },
        { name: 'confirm_plan', description: 'Confirm sessions', parameters: { type: 'object', properties: {} } },
      ];
      const messages = [{ role: 'user' as const, content: 'suggest some options' }];

      const result = await llmService.generateWithTools('System prompt', messages, tools);

      expect(result.type).toBe('text');
      expect((result as any).content).toBeTruthy();
    });

    it('should delegate to appropriate agent in coordinator mode on first call', async () => {
      const tools = [
        { name: 'delegate', description: 'Delegate to specialist', parameters: { type: 'object', properties: {} } },
        { name: 'respond', description: 'Respond directly', parameters: { type: 'object', properties: {} } },
      ];
      const messages = [{ role: 'user' as const, content: 'help me plan my week' }];

      const result = await llmService.generateWithTools('State: PLANNING', messages, tools);

      expect(result.type).toBe('tool_call');
      expect((result as any).name).toBe('delegate');
    });

    it('should return respond tool_call after delegation result in coordinator mode', async () => {
      const tools = [
        { name: 'delegate', description: 'Delegate', parameters: { type: 'object', properties: {} } },
        { name: 'respond', description: 'Respond', parameters: { type: 'object', properties: {} } },
      ];
      const messages = [
        { role: 'user' as const, content: 'help me plan' },
        { role: 'assistant' as const, content: '', toolCall: { id: 'c1', name: 'delegate', args: { agent: 'planning' } } },
        { role: 'tool' as const, content: JSON.stringify({ response: 'Here are your options', suggested_state: 'PLANNING' }), toolCallId: 'c1', toolName: 'delegate' }
      ];

      const result = await llmService.generateWithTools('State: PLANNING', messages, tools);

      expect(result.type).toBe('tool_call');
      expect((result as any).name).toBe('respond');
    });
  });
});
