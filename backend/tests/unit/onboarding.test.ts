import { onboardingAgent } from '../../src/specialists/onboarding.agent.js';

describe('OnboardingAgent stage gating (spec 003-onboarding-stage-completeness)', () => {
  it('does not advance past S4 when only part of what it asks for was answered', async () => {
    const result = await onboardingAgent.executeTurn('ONBOARDING_S4', 'I can do 4 hours a week', {}, 0);

    expect(result.nextState).toBe('ONBOARDING_S4');
    expect(result.slotsFilled?.weekly_time_budget_hours).toBe(4);
    expect(result.slotsFilled?.best_time).toBeUndefined();
  });

  it('advances past S4 once the remaining piece is answered, using what was already captured', async () => {
    const result = await onboardingAgent.executeTurn(
      'ONBOARDING_S4',
      'mornings work best',
      { weekly_time_budget_hours: 4 },
      1
    );

    expect(result.nextState).toBe('ONBOARDING_S5');
    expect(result.slotsFilled?.best_time).toBe('morning');
  });

  it('advances past the turn limit without fabricating a value for what was never answered', async () => {
    const result = await onboardingAgent.executeTurn('ONBOARDING_S4', 'ok', {}, 2);

    expect(result.nextState).toBe('ONBOARDING_S5');
    expect(result.slotsFilled?.weekly_time_budget_hours).toBeUndefined();
    expect(result.slotsFilled?.best_time).toBeUndefined();
  });

  it('does not advance past S6 without a genuine confirmation signal', async () => {
    const stillCorrecting = await onboardingAgent.executeTurn(
      'ONBOARDING_S6',
      "actually, let's change my goal",
      { primary_goal: 'Learn guitar' },
      0
    );
    expect(stillCorrecting.nextState).toBe('ONBOARDING_S6');

    const confirmed = await onboardingAgent.executeTurn(
      'ONBOARDING_S6',
      'yes, that looks right',
      { primary_goal: 'Learn guitar' },
      1
    );
    expect(confirmed.nextState).toBe('PLANNING');
  });
});

describe('OnboardingAgent no-fabrication capture (spec 003-onboarding-stage-completeness)', () => {
  it('captures the raw S2 message as the motivation reason instead of a generic default', async () => {
    const result = await onboardingAgent.executeTurn('ONBOARDING_S2', 'I want to build a career in data science', {}, 0);

    expect(result.slotsFilled?.motivation_reasons).toEqual(['I want to build a career in data science']);
  });

  it('captures the raw S3 message as both past_attempts and barriers instead of empty defaults', async () => {
    const result = await onboardingAgent.executeTurn(
      'ONBOARDING_S3',
      'I tried a bootcamp but stopped after moving cities',
      {},
      0
    );

    expect(result.slotsFilled?.past_attempts).toEqual(['I tried a bootcamp but stopped after moving cities']);
    expect(result.slotsFilled?.barriers).toEqual(['I tried a bootcamp but stopped after moving cities']);
  });

  it('derives success_definition from the accumulated primary_goal instead of a fixed literal', async () => {
    const result = await onboardingAgent.executeTurn(
      'ONBOARDING_S5',
      '8 out of 10',
      { primary_goal: 'Learn Spanish' },
      0
    );

    expect(result.slotsFilled?.success_definition).toContain('Learn Spanish');
    expect(result.slotsFilled?.success_definition).not.toBe('Complete weekly learning sessions consistently');
  });
});
