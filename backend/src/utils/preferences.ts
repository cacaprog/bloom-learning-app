import { LearnerProfile } from '../models/profile.js';

export interface PreferenceContext {
  weeklyTimeBudgetHours: number | null;
  bestTime: string | null;
  isMissing: boolean;
  source: 'stored' | 'conversation-override' | 'missing';
}

const HOURS_PATTERN = /(\d+)\s*hours?/i;
const BEST_TIME_PATTERN = /\b(morning|afternoon|evening|night)s?\b/i;

/**
 * Scans the learner's own messages for a stated weekly-hours or best-time
 * preference, most recent first, so a preference stated earlier in the
 * current conversation can override an older stored value (FR-005).
 */
function findConversationOverride(planningHistory: any[]): { weeklyTimeBudgetHours?: number; bestTime?: string } {
  const learnerMessages = planningHistory.filter(h => h.role === 'user' || h.role === 'learner');

  for (let i = learnerMessages.length - 1; i >= 0; i--) {
    const content: string = learnerMessages[i]?.content || '';
    const hoursMatch = content.match(HOURS_PATTERN);
    const timeMatch = content.match(BEST_TIME_PATTERN);
    if (hoursMatch || timeMatch) {
      return {
        weeklyTimeBudgetHours: hoursMatch ? Number(hoursMatch[1]) : undefined,
        bestTime: timeMatch ? timeMatch[1].toLowerCase() : undefined,
      };
    }
  }

  return {};
}

/**
 * Resolves the learner's weekly time budget and best-time preference without
 * ever silently substituting a generic default for a preference the learner
 * never stated (see spec 001-schedule-suggestion-accuracy, FR-006/FR-007).
 */
export function resolvePreferenceContext(
  profile: LearnerProfile | null | undefined,
  planningHistory: any[] = []
): PreferenceContext {
  const override = findConversationOverride(planningHistory);

  if (override.weeklyTimeBudgetHours != null || override.bestTime != null) {
    return {
      weeklyTimeBudgetHours: override.weeklyTimeBudgetHours ?? profile?.weekly_time_budget_hours ?? null,
      bestTime: override.bestTime ?? profile?.best_time ?? null,
      isMissing: false,
      source: 'conversation-override',
    };
  }

  if (!profile) {
    return { weeklyTimeBudgetHours: null, bestTime: null, isMissing: true, source: 'missing' };
  }

  const isMissing = profile.weekly_time_budget_hours == null || profile.best_time == null;

  return {
    weeklyTimeBudgetHours: profile.weekly_time_budget_hours,
    bestTime: profile.best_time,
    isMissing,
    source: isMissing ? 'missing' : 'stored',
  };
}
