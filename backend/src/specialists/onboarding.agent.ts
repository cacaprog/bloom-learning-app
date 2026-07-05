import { llmService } from '../services/llm.service.js';
import { LearnerProfile } from '../models/profile.js';

export interface OnboardingStateResult {
  response: string;
  nextState: string;
  slotsFilled?: {
    primary_goal?: string;
    goal_category?: string;
    motivation_reasons?: string[];
    past_attempts?: string[];
    barriers?: string[];
    weekly_time_budget_hours?: number;
    best_time?: string;
    confidence_score?: number;
    readiness_stage?: string;
    success_definition?: string;
  };
}

const MAX_TURNS_PER_STATE = 3;

export class OnboardingAgent {
  public async executeTurn(
    currentState: string,
    message: string,
    slots: Partial<LearnerProfile> | undefined,
    stateTurnCount: number
  ): Promise<OnboardingStateResult> {
    const text = message.toLowerCase();
    const provider = llmService.getProvider();
    const atTurnLimit = stateTurnCount + 1 >= MAX_TURNS_PER_STATE;

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
      slotsFilled = { primary_goal: message, motivation_reasons: [message] };
      if (category) slotsFilled.goal_category = category;
    } else if (currentState === 'ONBOARDING_S3') {
      // History & barriers are discussed together in one open turn — capture the
      // learner's own words for both rather than fabricating an empty default.
      const hasSignal = message.trim().length > 0;
      slotsFilled = {};
      if (hasSignal) {
        slotsFilled.past_attempts = [message];
        slotsFilled.barriers = [message];
      }
      nextState = (hasSignal || atTurnLimit) ? 'ONBOARDING_S4' : 'ONBOARDING_S3';
    } else if (currentState === 'ONBOARDING_S4') {
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

      const hasHours = hours !== undefined || slots?.weekly_time_budget_hours != null;
      const hasBestTime = bestTime !== undefined || slots?.best_time != null;
      nextState = (hasHours && hasBestTime) || atTurnLimit ? 'ONBOARDING_S5' : 'ONBOARDING_S4';
    } else if (currentState === 'ONBOARDING_S5') {
      // Guard: if the message is about time, the user probably answered the wrong question.
      // Don't capture it as confidence — leave undefined so the coach will ask again.
      const isTimeAnswer = /\b(?:hours?|hrs?|minutes?|per\s+week|weekly|\/week)\b/i.test(text);
      const confMatch = !isTimeAnswer ? text.match(/\b([1-9]|10)\b/) : null;
      const score = confMatch ? parseInt(confMatch[1]) : undefined;

      slotsFilled = {};
      if (score !== undefined) {
        slotsFilled.confidence_score = score;
        slotsFilled.readiness_stage = score >= 7 ? 'action' : 'preparation';
      }

      const hasScore = score !== undefined || slots?.confidence_score != null;
      nextState = hasScore || atTurnLimit ? 'ONBOARDING_S6' : 'ONBOARDING_S5';
      if (nextState === 'ONBOARDING_S6') {
        const goalForSummary = (slots?.primary_goal as string) || 'their goal';
        slotsFilled.success_definition = `Consistently make progress on: ${goalForSummary}`;
      }
    } else if (currentState === 'ONBOARDING_S6') {
      // Reuse the same lightweight agreement-keyword approach used elsewhere
      // (e.g. planning's confirm_plan triggering) rather than requiring an exact phrase.
      const confirmed = text.includes('confirm') || text.includes('yes') || text.includes('agree') || text.includes('correct') || text.includes('right');
      nextState = confirmed || atTurnLimit ? 'PLANNING' : 'ONBOARDING_S6';
    }

    const stayed = nextState === currentState;

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
      if (stayed) {
        promptInput += `\nStill missing for this state — ask specifically for it, don't move on yet.`;
      }
      response = await llmService.generate('onboarding', promptInput);
    } else if (stayed) {
      switch (currentState) {
        case 'ONBOARDING_S3':
          response = "No rush — what's one thing you've tried before, or what's gotten in the way?";
          break;
        case 'ONBOARDING_S4':
          if (slotsFilled.weekly_time_budget_hours !== undefined) {
            response = "Got it — and when do you tend to feel most focused (morning, midday, evening)?";
          } else if (slotsFilled.best_time !== undefined) {
            response = "Thanks — and about how many hours a week can you realistically protect for this?";
          } else {
            response = "How many hours a week can you realistically protect for this, and when do you feel most focused (morning, midday, evening)?";
          }
          break;
        case 'ONBOARDING_S5':
          response = "On a scale of 1 to 10, how confident do you feel about sticking to this schedule?";
          break;
        case 'ONBOARDING_S6':
          response = "No problem — what would you like to change?";
          break;
        default:
          response = "Could you tell me a bit more about that?";
      }
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
