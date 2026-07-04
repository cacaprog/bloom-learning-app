import { llmService } from '../services/llm.service.js';
import { LearnerProfile } from '../models/profile.js';

export interface OnboardingStateResult {
  response: string;
  nextState: string;
  slotsFilled?: {
    primary_goal?: string;
    goal_category?: string;
    weekly_time_budget_hours?: number;
    best_time?: string;
    confidence_score?: number;
    readiness_stage?: string;
    success_definition?: string;
  };
}

export class OnboardingAgent {
  public async executeTurn(
    currentState: string,
    message: string,
    slots?: Partial<LearnerProfile>
  ): Promise<OnboardingStateResult> {
    const text = message.toLowerCase();
    const provider = llmService.getProvider();

    // 1. Unified state transitions and slot parsing first
    let nextState = 'ONBOARDING_S1';
    let slotsFilled: any = {};

    if (currentState === 'ONBOARDING_S1') {
      nextState = 'ONBOARDING_S2';
    } else if (currentState === 'ONBOARDING_S2') {
      nextState = 'ONBOARDING_S3';
      // Detect category only when clearly signalled — no default fallback.
      // The LLM will carry unlabelled goals fine without a forced category.
      const category =
        /\btech|cod(e|ing)|program|software|data\b/i.test(text) ? 'technical'
        : /\blang|speak|french|spanish|english|portuguese|japanese|chinese|german\b/i.test(text) ? 'language'
        : /\bcreat|art\b|music|design|writ|draw|paint|photo\b/i.test(text) ? 'creative'
        : /\bfun\b|hobby|personal|passion|interest\b/i.test(text) ? 'personal'
        : /\bprofession|career|work\b|business|job\b/i.test(text) ? 'professional'
        : null;
      slotsFilled = { primary_goal: message };
      if (category) slotsFilled.goal_category = category;
    } else if (currentState === 'ONBOARDING_S3') {
      nextState = 'ONBOARDING_S4';
    } else if (currentState === 'ONBOARDING_S4') {
      nextState = 'ONBOARDING_S5';
      // Require "hours"/"hrs" context so a standalone number like "5" isn't grabbed
      const hoursPattern = text.match(/\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h\/week)\b/i)
        || text.match(/\b(\d+)\s+(?:per\s+)?(?:week|weekly)\b/i);
      const hours = hoursPattern ? parseFloat(hoursPattern[1]) : undefined;
      const bestTime = text.includes('morning') ? 'morning'
        : text.includes('evening') ? 'evening'
        : text.includes('midday') ? 'midday'
        : text.includes('afternoon') ? 'afternoon'
        : text.includes('night') ? 'evening'
        : undefined;

      slotsFilled = {};
      if (hours !== undefined) slotsFilled.weekly_time_budget_hours = hours;
      if (bestTime !== undefined) slotsFilled.best_time = bestTime;
    } else if (currentState === 'ONBOARDING_S5') {
      nextState = 'ONBOARDING_S6';
      // Guard: if the message is about time, the user probably answered the wrong question.
      // Don't capture it as confidence — leave undefined so the LLM will ask again.
      const isTimeAnswer = /\b(?:hours?|hrs?|minutes?|per\s+week|weekly|\/week)\b/i.test(text);
      const confMatch = !isTimeAnswer ? text.match(/\b([1-9]|10)\b/) : null;
      const score = confMatch ? parseInt(confMatch[1]) : undefined;

      slotsFilled = {};
      if (score !== undefined) {
        slotsFilled.confidence_score = score;
        slotsFilled.readiness_stage = score >= 7 ? 'action' : 'preparation';
      }
      slotsFilled.success_definition = 'Complete weekly learning sessions consistently';
    } else if (currentState === 'ONBOARDING_S6') {
      nextState = 'PLANNING';
    }

    // 2. Generate response text
    let response: string;
    if (provider !== 'mock') {
      const mergedSlots = { ...slots, ...slotsFilled };
      // Strip null/undefined so the LLM doesn't see incomplete fields and over-infer
      const knownSlots = Object.fromEntries(
        Object.entries(mergedSlots).filter(([, v]) => v != null)
      );
      let promptInput = `Current State: ${currentState}. User message: ${message}`;
      if (Object.keys(knownSlots).length > 0) {
        promptInput += `\nProfile details gathered so far:\n${JSON.stringify(knownSlots, null, 2)}`;
      }
      response = await llmService.generate('onboarding', promptInput);
    } else {
      switch (currentState) {
        case 'ONBOARDING_S1':
          response = "What skill are you looking to learn, and what category does it fit in (e.g. technical, professional, creative, language)?";
          break;
        case 'ONBOARDING_S2':
          response = "Got it. Have you tried learning this before? If so, what got in the way in your past attempts?";
          break;
        case 'ONBOARDING_S3':
          response = "That's common. How many hours a week can you realistically protect for this, and when do you feel most focused (morning, midday, evening)?";
          break;
        case 'ONBOARDING_S4':
          response = "Understood. On a scale of 1 to 10, how confident do you feel about sticking to this schedule?";
          break;
        case 'ONBOARDING_S5':
          response = "Thank you. Let me summarize your profile: You want to learn this skill to achieve your goals, scheduling it for your preferred times. Do you confirm this outline?";
          break;
        case 'ONBOARDING_S6':
          response = "Excellent! Your learner profile is confirmed. Let's start co-creating your weekly plan.";
          break;
        default:
          response = "Welcome! I'll ask you a few questions to help shape your self-directed learning journey. Ready to start?";
      }
    }

    return { response, nextState, slotsFilled };
  }
}

export const onboardingAgent = new OnboardingAgent();
