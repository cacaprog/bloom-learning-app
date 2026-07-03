import { promptService } from '../services/prompt.service.js';
import { llmService } from '../services/llm.service.js';
import { cleanJsonMarkdown } from '../utils/json.js';

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

function extractSpecificDays(text: string): number[] {
  const dayMap: Record<string, number> = {
    'monday': 1, 'mon': 1,
    'tuesday': 2, 'tues': 2, 'tue': 2,
    'wednesday': 3, 'wed': 3,
    'thursday': 4, 'thurs': 4, 'thu': 4,
    'friday': 5, 'fri': 5,
    'saturday': 6, 'sat': 6,
    'sunday': 0, 'sun': 0
  };

  const foundDays: number[] = [];
  for (const [dayName, dayIndex] of Object.entries(dayMap)) {
    const regex = new RegExp(`\\b${dayName}\\b`, 'i');
    if (regex.test(text)) {
      if (!foundDays.includes(dayIndex)) {
        foundDays.push(dayIndex);
      }
    }
  }
  return foundDays.sort((a, b) => a - b);
}

function parseSessionPreferences(history: any[], currentMessage: string) {
  const allTexts = [currentMessage, ...history.map(h => h.content).reverse()];
  
  for (const text of allTexts) {
    const lower = text.toLowerCase();
    
    // Check for patterns like: "2 days", "3 sessions", "twice a week"
    const daysMatch = lower.match(/\b(\d+)\s*(?:day|session|time)s?\b/);
    if (daysMatch) {
      const count = parseInt(daysMatch[1], 10);
      if (count >= 1 && count <= 7) {
        return { sessionCount: count, preferredDays: extractSpecificDays(lower) };
      }
    }
    
    if (lower.includes('twice a week') || lower.includes('2x a week') || lower.includes('2x/week')) {
      return { sessionCount: 2, preferredDays: extractSpecificDays(lower) };
    }
    if (lower.includes('thrice a week') || lower.includes('3x a week') || lower.includes('3x/week')) {
      return { sessionCount: 3, preferredDays: extractSpecificDays(lower) };
    }
    if (lower.includes('once a week') || lower.includes('1x a week') || lower.includes('1x/week')) {
      return { sessionCount: 1, preferredDays: extractSpecificDays(lower) };
    }

    const specificDays = extractSpecificDays(lower);
    if (specificDays.length > 0) {
      return { sessionCount: specificDays.length, preferredDays: specificDays };
    }
  }

  return { sessionCount: 3, preferredDays: [] };
}

function getNextDayOfWeek(dayOfWeek: number, referenceDate: Date = new Date()): Date {
  const resultDate = new Date(referenceDate);
  const currentDay = resultDate.getDay();
  let daysToAdd = (dayOfWeek - currentDay + 7) % 7;
  if (daysToAdd === 0) {
    daysToAdd = 7;
  }
  resultDate.setDate(resultDate.getDate() + daysToAdd);
  return resultDate;
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
    // 1. Propose or confirm plan details
    const budget = profile?.weekly_time_budget_hours || 6;
    const { sessionCount, preferredDays } = parseSessionPreferences(planningHistory, message);
    const duration = Math.round((budget * 60) / sessionCount);

    const bestTime = profile?.best_time || 'evening';
    let targetHour = 19; // default evening (7 PM)
    if (bestTime === 'morning') {
      targetHour = 9; // 9 AM
    } else if (bestTime === 'midday') {
      targetHour = 13; // 1 PM
    }

    const dayNames = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
    let formattedDays = preferredDays.map(d => dayNames[d]).join(' and ');
    if (preferredDays.length === 0) {
      const fallbacks = [1, 3, 5];
      formattedDays = fallbacks.slice(0, sessionCount).map(d => dayNames[d]).join(', ');
    }

    // 2. Build parameterized prompt with strict constraints
    const systemPrompt = promptService.getPrompt('planning')
      .replace(/{primary_goal}/g, goal)
      .replace(/{weekly_time_budget_hours}/g, String(budget))
      .replace(/{session_count}/g, String(sessionCount))
      .replace(/{session_duration_minutes}/g, String(duration))
      .replace(/{preferred_days}/g, formattedDays)
      .replace(/{best_time}/g, bestTime);

    const isCommandBypass = text.includes('/confirm-plan') || text.includes('i confirm the plan');

    // Find the latest onboarding completion message index in history if any
    const lastOnboardingIndex = planningHistory.map(h => h.content.toLowerCase()).lastIndexOf(
      planningHistory.map(h => h.content.toLowerCase()).find(c => 
        c.includes('personalized learning path') || 
        c.includes('co-creating your weekly plan') ||
        c.includes('learning path is ready')
      ) || ''
    );

    const hasTransitionedFromOnboarding = lastOnboardingIndex !== -1;

    // Check if options were proposed after the onboarding transition
    const optionsProposed = planningHistory.slice(lastOnboardingIndex + 1).some(h => 
      h.role === 'coach' && 
      (
        h.content.toLowerCase().includes('option a') || 
        h.content.toLowerCase().includes('option b') || 
        h.content.toLowerCase().includes('style') ||
        h.content.toLowerCase().includes('choose either') ||
        h.content.toLowerCase().includes('which style')
      )
    ) || 
    text.includes('option a') || 
    text.includes('option b');

    let isConfirmed = (text.includes('confirm') || text.includes('yes') || text.includes('agree')) && 
                      (isCommandBypass || optionsProposed || !hasTransitionedFromOnboarding);

    const sessions = Array.from({ length: sessionCount }).map((_, i) => {
      let scheduledDate: Date;
      if (preferredDays.length > 0) {
        const dayOfWeek = preferredDays[i % preferredDays.length];
        const weeksToAdd = Math.floor(i / preferredDays.length);
        scheduledDate = getNextDayOfWeek(dayOfWeek);
        if (weeksToAdd > 0) {
          scheduledDate.setDate(scheduledDate.getDate() + weeksToAdd * 7);
        }
      } else {
        scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + (i + 1) * 2);
      }
      scheduledDate.setHours(targetHour, 0, 0, 0);
      return {
        topic: `Study session ${i + 1} for ${goal}`,
        duration_minutes: duration,
        scheduled_at: scheduledDate,
        format: 'practice',
        effort_level: 'moderate',
      };
    });

    sessions.sort((a, b) => a.scheduled_at.getTime() - b.scheduled_at.getTime());
    sessions.forEach((s, idx) => {
      s.topic = `Study session ${idx + 1} for ${goal}`;
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
    const cleanedResponse = cleanJsonMarkdown(rawResponse);
    try {
      parsed = JSON.parse(cleanedResponse);
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

    // Enforce that a plan cannot be confirmed unless options were already proposed, or the user bypassed via command
    if (result.confirmed && hasTransitionedFromOnboarding && !optionsProposed && !isCommandBypass) {
      result.confirmed = false;
      console.log('[PlanningAgent] Overrode LLM confirmed=true because no options were proposed in history yet.');
    }

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
