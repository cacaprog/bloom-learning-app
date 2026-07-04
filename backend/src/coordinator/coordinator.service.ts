import { safetyFilter } from './safety.filter.js';
import { onboardingAgent } from '../specialists/onboarding.agent.js';
import { planningAgent } from '../specialists/planning.agent.js';
import { recoveryAgent } from '../specialists/recovery.agent.js';
import { reflectionAgent } from '../specialists/reflection.agent.js';
import { LearnerProfileModel, LearnerProfile } from '../models/profile.js';
import { WeeklyPlanModel } from '../models/plan.js';
import { LearningSessionModel } from '../models/session.js';
import { ReflectionEntryModel } from '../models/reflection.js';
import { calendarService } from '../services/calendar.service.js';
import { llmService, ToolDefinition, ToolMessage } from '../services/llm.service.js';
import { promptService } from '../services/prompt.service.js';
import { memoryService } from '../services/memory.service.js';
import crypto from 'crypto';

export interface CoordinatorContext {
  userId: string;
  currentState: string;
  lastMessages: any[];
}

export interface CoordinatorResponse {
  responseToUser: string;
  newState: string;
  agentDelegation: { agent: string; task: string } | null;
  safetyCheckPassed: boolean;
}

interface SpecialistResult {
  response: string;
  suggestedNextState: string;
  delegationMeta?: {
    agent: string;
    task: string;
  };
  data?: {
    slotsFilled?: Record<string, any>;
    onboardingComplete?: boolean;
    planConfirmed?: boolean;
    proposedPlan?: {
      weekly_goal: string;
      sessions: Array<{
        topic: string;
        duration_minutes: number;
        scheduled_at: Date;
        format: string;
        effort_level: string;
        calendar_event_id: string;
      }>;
    };
    rescheduleNeeded?: boolean;
    recoveryNextStage?: string;
    isFirstReflectionTurn?: boolean;
    activePromptText?: string;
    reflectionText?: string | null;
    reflectionSkipped?: boolean;
    triggerType?: string;
  };
}

const COORDINATOR_TOOLS: ToolDefinition[] = [
  {
    name: 'delegate',
    description: 'Hand off the user message to a specialist agent. The specialist handles the conversation for this turn and returns a response.',
    parameters: {
      type: 'object',
      properties: {
        agent: { type: 'string', enum: ['onboarding', 'planning', 'recovery', 'reflection'], description: 'Specialist to delegate to' },
        reason: { type: 'string', description: 'One-sentence rationale for this delegation' }
      },
      required: ['agent', 'reason']
    }
  },
  {
    name: 'respond',
    description: 'Send a response directly to the user without delegating. Use for out-of-scope messages, brief redirects, or when no specialist is needed.',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The response text to send to the user' },
        new_state: { type: 'string', description: 'The conversation state to transition to' }
      },
      required: ['message', 'new_state']
    }
  }
];

export class CoordinatorService {
  private static onboardingSlots: Record<string, Partial<LearnerProfile>> = {};
  private static recoveryStages: Record<string, string> = {};
  private static activePrompts: Record<string, string> = {};

  public async processMessage(
    userId: string,
    userMessage: string,
    context: CoordinatorContext
  ): Promise<CoordinatorResponse> {
    const { currentState, lastMessages } = context;
    let newState = currentState;
    let responseToUser = '';
    let lastAgentDelegation: { agent: string; task: string } | null = null;

    // Build memory context once per turn — injected into each specialist
    const memoryContext = await memoryService.buildContext(userId).catch(() => '');

    const coordinatorPrompt = this.buildCoordinatorPrompt(currentState);

    const routingMessages: ToolMessage[] = [
      ...lastMessages.slice(-10).map(m => ({
        role: (m.role === 'coach' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.content
      })),
      { role: 'user' as const, content: userMessage }
    ];

    for (let iteration = 0; iteration < 3; iteration++) {
      let routing;
      try {
        routing = await llmService.generateWithTools(coordinatorPrompt, routingMessages, COORDINATOR_TOOLS);
      } catch (err) {
        console.error('[Coordinator] generateWithTools failed:', err);
        responseToUser = "I'm here to support your learning journey. What would you like to focus on?";
        break;
      }

      if (routing.type === 'text') {
        responseToUser = routing.content;
        break;
      }

      if (routing.name === 'respond') {
        responseToUser = routing.args.message as string;
        const declaredState = routing.args.new_state as string;
        if (declaredState) newState = declaredState;
        break;
      }

      if (routing.name === 'delegate') {
        const agentName = routing.args.agent as string;
        lastAgentDelegation = { agent: agentName, task: `Turn in state ${currentState}` };

        let specialistResult: SpecialistResult;
        try {
          specialistResult = await this.executeSpecialist(agentName, userMessage, context, userId, memoryContext);
        } catch (err) {
          console.error(`[Coordinator] Delegation to ${agentName} failed:`, err);
          responseToUser = "Let's keep focusing on your goals. What feels right to focus on now?";
          break;
        }

        await this.handleSideEffects(agentName, specialistResult, userId);
        newState = specialistResult.suggestedNextState;
        responseToUser = specialistResult.response;

        // Fire-and-forget memory extraction (onboarding excluded — profile captured structurally)
        if (agentName !== 'onboarding') {
          const turnMessages = [
            ...lastMessages.slice(-3),
            { role: 'user', content: userMessage },
            { role: 'coach', content: specialistResult.response },
          ];
          memoryService.extractAndStore(userId, turnMessages, agentName);
        }

        // Only cascade back into the loop for recovery→reflection handoff.
        // All other delegations are final — the specialist owns the state transition.
        // Looping back and letting the coordinator LLM call respond() would allow it
        // to override the specialist's suggestedNextState with a wrong value.
        const cascadeToReflection =
          specialistResult.suggestedNextState === 'REFLECTION' && agentName !== 'reflection';

        if (!cascadeToReflection) {
          break;
        }

        routingMessages.push({
          role: 'assistant',
          content: '',
          toolCall: { id: `delegate-${iteration}`, name: 'delegate', args: routing.args }
        });
        routingMessages.push({
          role: 'tool',
          content: JSON.stringify({ response: specialistResult.response, suggested_state: specialistResult.suggestedNextState }),
          toolCallId: `delegate-${iteration}`,
          toolName: 'delegate'
        });
      }
    }

    const safetyCheck = safetyFilter.scan(responseToUser);
    if (!safetyCheck.passed) {
      responseToUser = 'I want to support you in finding a sustainable rhythm. What is one small step you can take today?';
    }

    return {
      responseToUser,
      newState,
      agentDelegation: lastAgentDelegation,
      safetyCheckPassed: safetyCheck.passed
    };
  }

  private buildCoordinatorPrompt(currentState: string): string {
    const base = promptService.getPrompt('coordinator');
    return base.replace(/{current_state}/g, currentState);
  }

  private async executeSpecialist(
    agentName: string,
    userMessage: string,
    context: CoordinatorContext,
    userId: string,
    memoryContext = ''
  ): Promise<SpecialistResult> {
    const { currentState } = context;

    switch (agentName) {
      case 'onboarding': {
        // Onboarding is first contact — memory context not injected here
        const result = await onboardingAgent.executeTurn(
          currentState,
          userMessage,
          CoordinatorService.onboardingSlots[userId] || {}
        );
        return {
          response: result.response,
          suggestedNextState: result.nextState,
          delegationMeta: { agent: 'onboarding', task: `Onboarding turn for state ${currentState}` },
          data: {
            slotsFilled: result.slotsFilled || {},
            onboardingComplete: result.nextState === 'PLANNING'
          }
        };
      }

      case 'planning': {
        const profile = await LearnerProfileModel.findByUserId(userId);
        const result = await planningAgent.processTurn(userMessage, profile, context.lastMessages || [], memoryContext);
        return {
          response: result.response,
          suggestedNextState: result.confirmed ? 'ACTIVE_WEEK' : currentState,
          delegationMeta: { agent: 'planning', task: `Planning turn` },
          data: {
            planConfirmed: result.confirmed,
            proposedPlan: result.proposedPlan
          }
        };
      }

      case 'recovery': {
        const stage = CoordinatorService.recoveryStages[userId] || 'INITIATE';
        const result = await recoveryAgent.processTurn(userMessage, stage, memoryContext);
        const nextStage = result.nextStage;

        if (nextStage === 'ACTIVE_WEEK') {
          const prompt = await reflectionAgent.generatePrompt('recovery_completion', memoryContext);
          return {
            response: prompt,
            suggestedNextState: 'REFLECTION',
            delegationMeta: { agent: 'recovery', task: `Recovery → reflection transition` },
            data: {
              rescheduleNeeded: result.rescheduleNeeded,
              recoveryNextStage: 'ACTIVE_WEEK',
              isFirstReflectionTurn: true,
              activePromptText: prompt
            }
          };
        }

        return {
          response: result.response,
          suggestedNextState: `RECOVERY_${nextStage}`,
          delegationMeta: { agent: 'recovery', task: `Recovery stage: ${stage}` },
          data: {
            rescheduleNeeded: result.rescheduleNeeded,
            recoveryNextStage: nextStage
          }
        };
      }

      case 'reflection': {
        const isEntry = userMessage.toLowerCase().includes('finished') ||
                        userMessage.toLowerCase().includes('review');
        if (isEntry) {
          const triggerType = userMessage.toLowerCase().includes('review') ? 'weekly_review' : 'session_completion';
          const prompt = await reflectionAgent.generatePrompt(triggerType, memoryContext);
          return {
            response: prompt,
            suggestedNextState: 'REFLECTION',
            delegationMeta: { agent: 'reflection', task: `Trigger: ${triggerType}` },
            data: { isFirstReflectionTurn: true, activePromptText: prompt, triggerType }
          };
        }

        const activePrompt = CoordinatorService.activePrompts[userId] || 'What went well?';
        const result = await reflectionAgent.processResponse(userMessage);
        return {
          response: "We're back on track! Let me know if you need to adjust anything else.",
          suggestedNextState: 'ACTIVE_WEEK',
          delegationMeta: { agent: 'reflection', task: 'Process reflection response' },
          data: {
            isFirstReflectionTurn: false,
            activePromptText: activePrompt,
            reflectionText: result.text,
            reflectionSkipped: result.skipped,
            triggerType: 'session_completion'
          }
        };
      }

      default:
        throw new Error(`Unknown agent: ${agentName}`);
    }
  }

  private async handleSideEffects(agentName: string, result: SpecialistResult, userId: string): Promise<void> {
    const data = result.data || {};

    if (agentName === 'onboarding') {
      if (data.slotsFilled && Object.keys(data.slotsFilled).length > 0) {
        CoordinatorService.onboardingSlots[userId] = {
          ...CoordinatorService.onboardingSlots[userId],
          ...data.slotsFilled
        };
      }
      if (data.onboardingComplete) {
        const slots = CoordinatorService.onboardingSlots[userId] || {};
        const profile: LearnerProfile = {
          id: crypto.randomUUID(),
          user_id: userId,
          primary_goal: (slots.primary_goal as string) || 'Learn a new skill',
          goal_category: (slots.goal_category as string) || 'technical',
          motivation_reasons: (slots.motivation_reasons as string[]) || ['Career growth'],
          past_attempts: (slots.past_attempts as string[]) || [],
          barriers: (slots.barriers as string[]) || [],
          weekly_time_budget_hours: (slots.weekly_time_budget_hours as number) || 5,
          best_time: (slots.best_time as string) || 'evening',
          preferred_formats: (slots.preferred_formats as string[]) || ['reading'],
          confidence_score: (slots.confidence_score as number) || 7,
          readiness_stage: (slots.readiness_stage as string) || 'action',
          success_definition: (slots.success_definition as string) || 'Consistency'
        };
        await LearnerProfileModel.create(profile);
        delete CoordinatorService.onboardingSlots[userId];
      }
    }

    if (agentName === 'planning') {
      if (data.planConfirmed && data.proposedPlan) {
        const planId = crypto.randomUUID();
        await WeeklyPlanModel.create({
          id: planId,
          user_id: userId,
          week_start: new Date().toISOString().split('T')[0],
          weekly_goal: data.proposedPlan.weekly_goal,
          flexibility_note: 'Dynamic planning'
        });

        for (const s of data.proposedPlan.sessions) {
          await LearningSessionModel.create({
            id: crypto.randomUUID(),
            plan_id: planId,
            scheduled_at: s.scheduled_at,
            duration_minutes: s.duration_minutes,
            topic: s.topic,
            format: s.format,
            effort_level: s.effort_level,
            status: 'planned',
            calendar_event_id: s.calendar_event_id
          });
        }
      }
    }

    if (agentName === 'recovery') {
      if (data.recoveryNextStage === 'ACTIVE_WEEK') {
        delete CoordinatorService.recoveryStages[userId];
        if (data.isFirstReflectionTurn && data.activePromptText) {
          CoordinatorService.activePrompts[userId] = data.activePromptText;
        }
      } else if (data.recoveryNextStage) {
        CoordinatorService.recoveryStages[userId] = data.recoveryNextStage;
      }

      if (data.rescheduleNeeded) {
        const plan = await WeeklyPlanModel.findLatestByUserId(userId);
        if (plan) {
          const sessions = await LearningSessionModel.findByPlanId(plan.id);
          const missed = sessions.find(s => s.status === 'missed');
          if (missed) {
            if (missed.calendar_event_id) {
              await calendarService.deleteEvent(missed.calendar_event_id);
            }
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(19, 0, 0, 0);
            const newEventId = await calendarService.createEvent(missed.topic, tomorrow, missed.duration_minutes);
            await LearningSessionModel.create({
              id: crypto.randomUUID(),
              plan_id: plan.id,
              scheduled_at: tomorrow,
              duration_minutes: missed.duration_minutes,
              topic: missed.topic,
              format: missed.format,
              effort_level: missed.effort_level,
              status: 'planned',
              calendar_event_id: newEventId
            });
            await LearningSessionModel.updateStatus(missed.id, 'rescheduled');
          }
        }
      }
    }

    if (agentName === 'reflection') {
      if (data.isFirstReflectionTurn && data.activePromptText) {
        CoordinatorService.activePrompts[userId] = data.activePromptText;
      } else if (!data.isFirstReflectionTurn) {
        try {
          await ReflectionEntryModel.create({
            id: crypto.randomUUID(),
            user_id: userId,
            trigger_type: (data.triggerType as 'session_completion' | 'weekly_review' | 'recovery_completion') || 'session_completion',
            prompt_text: data.activePromptText || '',
            response_text: data.reflectionText ?? null,
            skipped: data.reflectionSkipped || false
          });
        } catch (err) {
          console.error('[Coordinator] Failed to save reflection entry:', err);
        }
        delete CoordinatorService.activePrompts[userId];
      }
    }
  }
}

export const coordinatorService = new CoordinatorService();
