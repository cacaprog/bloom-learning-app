import { promptService } from '../services/prompt.service.js';
import { llmService, ToolDefinition, ToolMessage } from '../services/llm.service.js';
import { calendarService } from '../services/calendar.service.js';

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
      calendar_event_id: string;
    }[];
  };
  confirmed: boolean;
}

interface RawSession {
  title: string;
  scheduled_at: string;
  duration_minutes: number;
}

const PLANNING_TOOLS: ToolDefinition[] = [
  {
    name: 'get_free_busy',
    description: 'Get calendar availability for the next 7 days in 30-minute slots. Use this before proposing sessions.',
    parameters: {
      type: 'object',
      properties: {
        week_start: { type: 'string', description: 'ISO date for start of week (optional, defaults to today)' }
      },
      required: []
    }
  },
  {
    name: 'list_upcoming',
    description: 'List already-scheduled learning sessions to avoid double-booking.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max sessions to return (default 10)' }
      },
      required: []
    }
  },
  {
    name: 'propose_sessions',
    description: 'Commit to specific session times and present them to the learner. No calendar write yet — waits for learner confirmation. Use this to lock in specific times before asking the learner to confirm.',
    parameters: {
      type: 'object',
      properties: {
        sessions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              scheduled_at: { type: 'string', description: 'ISO datetime, e.g. 2026-07-08T19:00:00' },
              duration_minutes: { type: 'number', description: '15–90' }
            },
            required: ['title', 'scheduled_at', 'duration_minutes']
          }
        }
      },
      required: ['sessions']
    }
  },
  {
    name: 'confirm_plan',
    description: 'Write confirmed sessions to the calendar. Only call this after the learner has explicitly agreed. Provide the same sessions that were proposed.',
    parameters: {
      type: 'object',
      properties: {
        weekly_goal: { type: 'string', description: 'Short description of the weekly learning goal' },
        sessions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              scheduled_at: { type: 'string', description: 'ISO datetime' },
              duration_minutes: { type: 'number' }
            },
            required: ['title', 'scheduled_at', 'duration_minutes']
          }
        }
      },
      required: ['weekly_goal', 'sessions']
    }
  }
];

export class PlanningAgent {
  public async processTurn(
    message: string,
    profile: any,
    planningHistory: any[],
    memoryContext = ''
  ): Promise<PlanningResult> {
    const goal = profile?.primary_goal || 'your learning goal';
    const budget = profile?.weekly_time_budget_hours || 5;
    const bestTime = profile?.best_time || 'evening';

    const systemPrompt = promptService.getPrompt('planning')
      .replace(/{primary_goal}/g, goal)
      .replace(/{weekly_time_budget_hours}/g, String(budget))
      .replace(/{best_time}/g, bestTime)
      .replace(/{learner_context}/g, memoryContext);

    const messages: ToolMessage[] = [
      ...planningHistory.map(h => ({
        role: (h.role === 'coach' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: h.content
      })),
      { role: 'user' as const, content: message }
    ];

    for (let i = 0; i < 5; i++) {
      const result = await llmService.generateWithTools(systemPrompt, messages, PLANNING_TOOLS);

      if (result.type === 'text') {
        return { response: result.content, confirmed: false };
      }

      if (result.name === 'confirm_plan') {
        const rawSessions = result.args.sessions as RawSession[];
        const weeklyGoal = (result.args.weekly_goal as string) || `Complete study for ${goal}`;

        const sessionsWithIds = await Promise.all(
          rawSessions.map(async s => {
            const scheduledAt = new Date(s.scheduled_at);
            const eventId = await calendarService.createEvent(s.title, scheduledAt, s.duration_minutes);
            return {
              topic: s.title,
              duration_minutes: s.duration_minutes,
              scheduled_at: scheduledAt,
              format: 'practice' as const,
              effort_level: 'moderate' as const,
              calendar_event_id: eventId
            };
          })
        );

        const count = sessionsWithIds.length;
        const confirmationText = `Your plan is confirmed — ${count} session${count !== 1 ? 's' : ''} added to your calendar.`;

        return {
          response: confirmationText,
          confirmed: true,
          proposedPlan: { weekly_goal: weeklyGoal, sessions: sessionsWithIds }
        };
      }

      const toolResult = await this.executeTool(result.name, result.args, goal);

      messages.push({
        role: 'assistant',
        content: '',
        toolCall: { id: result.id, name: result.name, args: result.args }
      });
      messages.push({
        role: 'tool',
        content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
        toolCallId: result.id,
        toolName: result.name
      });
    }

    return {
      response: `Let's work on getting your ${goal} sessions scheduled. What days and times tend to work best for you this week?`,
      confirmed: false
    };
  }

  private async executeTool(name: string, args: Record<string, unknown>, goal: string): Promise<unknown> {
    switch (name) {
      case 'get_free_busy': {
        const weekStart = args.week_start ? new Date(args.week_start as string) : undefined;
        const slots = await calendarService.getFreeBusy(weekStart);
        const availableCount = slots.filter(s => s.available).length;
        return { slots, note: `${availableCount} of ${slots.length} half-hour slots are available this week.` };
      }
      case 'list_upcoming': {
        const limit = (args.limit as number) || 10;
        const events = await calendarService.listUpcoming(limit);
        return {
          sessions: events.map(e => ({
            title: e.title,
            start: e.start.toISOString(),
            end: e.end.toISOString()
          }))
        };
      }
      case 'propose_sessions': {
        const sessions = args.sessions as RawSession[];
        return {
          proposed: sessions.map(s => {
            const dt = new Date(s.scheduled_at);
            return {
              title: s.title,
              scheduled_at: s.scheduled_at,
              duration_minutes: s.duration_minutes,
              day: dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
              time: dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            };
          }),
          note: 'Sessions proposed. Present these to the learner. If the learner already agreed to these times in their last message, call confirm_plan immediately with these same sessions. Otherwise, present the proposal and wait for their response.'
        };
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }
}

export const planningAgent = new PlanningAgent();
