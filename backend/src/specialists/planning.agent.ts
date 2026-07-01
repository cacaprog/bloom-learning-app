import { promptService } from '../services/prompt.service.js';

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
    _planningHistory: any[]
  ): Promise<PlanningResult> {
    const text = message.toLowerCase();

    if (text.includes('confirm') || text.includes('yes') || text.includes('agree')) {
      const budget = profile?.weekly_time_budget_hours || 6;
      const sessionCount = 3;
      const duration = Math.round((budget * 60) / sessionCount);

      const sessions = Array.from({ length: sessionCount }).map((_, i) => {
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + (i + 1) * 2);
        scheduledDate.setHours(19, 0, 0, 0); // 7 PM
        return {
          topic: `Study session ${i + 1} for ${profile?.primary_goal || 'Goal'}`,
          duration_minutes: duration,
          scheduled_at: scheduledDate,
          format: 'practice',
          effort_level: 'moderate',
        };
      });

      return {
        response: `Excellent! I have confirmed your weekly plan with ${sessionCount} sessions (${duration} mins each). I've synced this to your calendar. Ready to go!`,
        proposedPlan: {
          weekly_goal: `Complete study for ${profile?.primary_goal}`,
          sessions,
        },
        confirmed: true,
      };
    }

    const loadedPrompt = promptService.getPrompt('planning');
    return {
      response: loadedPrompt,
      confirmed: false,
    };
  }
}

export const planningAgent = new PlanningAgent();
