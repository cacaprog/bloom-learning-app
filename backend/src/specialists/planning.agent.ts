import { promptService } from '../services/prompt.service.js';
import { llmService } from '../services/llm.service.js';

export interface PlanningResult {
  response: string;
  proposedPlan?: {
    weekly_goal: string;
    sessions: {
      topic: string;
      duration_minutes: number;
      scheduled_at: Date;
      format: string;
      effort_level: string;
    }[];
  };
  confirmed: boolean;
}

export class PlanningAgent {
  public async processTurn(
    message: string,
    profile: any,
    planningHistory: any[]
  ): Promise<PlanningResult> {
    const text = message.toLowerCase();
    const provider = llmService.getProvider();
    const goal = profile?.primary_goal || 'Goal';

    // 1. Build parameterized prompt
    const systemPrompt = promptService.getPrompt('planning')
      .replace(/{primary_goal}/g, goal);

    let isConfirmed = text.includes('confirm') || text.includes('yes') || text.includes('agree');
    
    // 2. Propose or confirm plan details
    const budget = profile?.weekly_time_budget_hours || 6;
    const sessionCount = 3;
    const duration = Math.round((budget * 60) / sessionCount);

    const sessions = Array.from({ length: sessionCount }).map((_, i) => {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + (i + 1) * 2);
      scheduledDate.setHours(19, 0, 0, 0); // 7 PM
      return {
        topic: `Study session ${i + 1} for ${goal}`,
        duration_minutes: duration,
        scheduled_at: scheduledDate,
        format: 'practice',
        effort_level: 'moderate',
      };
    });

    // 3. Build mock outputs for test/mock modes using the required JSON schema
    const mockConfirmJson = JSON.stringify({
      response: `Excellent! I have confirmed your weekly plan with ${sessionCount} sessions (${duration} mins each). I've synced this to your calendar. Ready to go!`,
      confirmed: true
    });

    const mockPlanJson = JSON.stringify({
      response: `Based on your budget, here's a starting point for studying ${goal}: Option A: Three 2-hour sessions on evenings, or Option B: Four 1.5-hour sessions on mornings. Which style fits best for you?`,
      confirmed: false
    });

    // 4. Resolve raw response text
    let rawResponse = '';
    if (isConfirmed) {
      rawResponse = provider !== 'mock'
        ? await llmService.generate(systemPrompt, `User has confirmed scheduling: ${message}`, planningHistory)
        : mockConfirmJson;
    } else {
      rawResponse = provider !== 'mock'
        ? await llmService.generate(systemPrompt, message, planningHistory)
        : mockPlanJson;
    }

    // 5. Parse response JSON and extract intent
    let parsed: { response: string; confirmed: boolean };
    try {
      parsed = JSON.parse(rawResponse);
    } catch (e) {
      console.warn('PlanningAgent failed to parse LLM response as JSON, falling back:', rawResponse);
      parsed = {
        response: rawResponse,
        confirmed: isConfirmed
      };
    }

    const result: PlanningResult = {
      response: parsed.response,
      confirmed: parsed.confirmed
    };

    if (result.confirmed) {
      result.proposedPlan = {
        weekly_goal: `Complete study for ${goal}`,
        sessions,
      };
    }

    return result;
  }
}

export const planningAgent = new PlanningAgent();
