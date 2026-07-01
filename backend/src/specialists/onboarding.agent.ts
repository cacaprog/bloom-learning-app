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
    turnCount: number
  ): Promise<OnboardingStateResult> {
    const text = message.toLowerCase();

    switch (currentState) {
      case 'ONBOARDING_S1':
        return {
          response: "What skill are you looking to learn, and what category does it fit in (e.g. technical, professional, creative, language)?",
          nextState: 'ONBOARDING_S2',
        };

      case 'ONBOARDING_S2': {
        const category = text.includes('tech') ? 'technical' : text.includes('lang') ? 'language' : 'professional';
        return {
          response: "Got it. Have you tried learning this before? If so, what got in the way in your past attempts?",
          nextState: 'ONBOARDING_S3',
          slotsFilled: {
            primary_goal: message,
            goal_category: category,
          },
        };
      }

      case 'ONBOARDING_S3':
        return {
          response: "That's common. How many hours a week can you realistically protect for this, and when do you feel most focused (morning, midday, evening)?",
          nextState: 'ONBOARDING_S4',
        };

      case 'ONBOARDING_S4': {
        const hoursMatch = text.match(/\b\d+\b/);
        const hours = hoursMatch ? parseInt(hoursMatch[0]) : 5;
        const bestTime = text.includes('morning') ? 'morning' : text.includes('evening') ? 'evening' : 'midday';
        return {
          response: "Understood. On a scale of 1 to 10, how confident do you feel about sticking to this schedule?",
          nextState: 'ONBOARDING_S5',
          slotsFilled: {
            weekly_time_budget_hours: hours,
            best_time: bestTime,
          },
        };
      }

      case 'ONBOARDING_S5': {
        const confMatch = text.match(/\b\d+\b/);
        const score = confMatch ? parseInt(confMatch[0]) : 7;
        return {
          response: "Thank you. Let me summarize your profile: You want to learn this skill to achieve your goals, scheduling it for your preferred times. Do you confirm this outline?",
          nextState: 'ONBOARDING_S6',
          slotsFilled: {
            confidence_score: score,
            readiness_stage: score >= 7 ? 'action' : 'preparation',
            success_definition: 'Complete weekly learning sessions consistently',
          },
        };
      }

      case 'ONBOARDING_S6':
        return {
          response: "Excellent! Your learner profile is confirmed. Let's start co-creating your weekly plan.",
          nextState: 'PLANNING',
        };

      default:
        return {
          response: "Welcome! I'll ask you a few questions to help shape your self-directed learning journey. Ready to start?",
          nextState: 'ONBOARDING_S1',
        };
    }
  }
}

export const onboardingAgent = new OnboardingAgent();
