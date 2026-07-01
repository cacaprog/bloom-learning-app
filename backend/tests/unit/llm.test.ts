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
});
