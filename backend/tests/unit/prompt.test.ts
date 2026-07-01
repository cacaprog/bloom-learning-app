import { promptService } from '../../src/services/prompt.service.js';

describe('PromptService Unit Tests', () => {
  afterAll(() => {
    promptService.close(); // Clean up watchers
  });

  it('should successfully load prompts from cache or fallback', () => {
    const onboardingPrompt = promptService.getPrompt('onboarding');
    expect(onboardingPrompt).toBeDefined();
    expect(onboardingPrompt.length).toBeGreaterThan(0);
  });

  it('should return correct fallback default on missing prompt key', () => {
    const defaultPrompt = promptService.getPrompt('invalid_key');
    expect(defaultPrompt).toContain('Coaching system instruction');
  });
});
