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

export class CoordinatorService {
  private static onboardingSlots: Record<string, Partial<LearnerProfile>> = {};
  private static recoveryStages: Record<string, string> = {};
  private static activePrompts: Record<string, string> = {};

  public async processMessage(
    userId: string,
    userMessage: string,
    context: CoordinatorContext
  ): Promise<CoordinatorResponse> {
    const currentState = context.currentState;
    let newState = currentState;
    let agentDelegation: { agent: string; task: string } | null = null;
    let responseToUser = '';

    // Routing Logic
    if (currentState.startsWith('ONBOARDING_') || currentState === 'NEW_USER') {
      agentDelegation = {
        agent: 'onboarding',
        task: `Process onboarding turn for state ${currentState} with message: ${userMessage}`,
      };
    } else if (currentState === 'PLANNING' || currentState === 'ACTIVE_WEEK') {
      if (userMessage.toLowerCase().includes('review')) {
        agentDelegation = {
          agent: 'reflection',
          task: `Trigger weekly review reflection: ${userMessage}`,
        };
        newState = 'REFLECTION';
      } else if (currentState === 'PLANNING') {
        agentDelegation = {
          agent: 'planning',
          task: `Generate or adjust weekly plan with message: ${userMessage}`,
        };
      } else {
        responseToUser = "I'm here to support your learning journey. Let's head back to our coaching plan.";
      }
    } else if (currentState.startsWith('RECOVERY')) {
      agentDelegation = {
        agent: 'recovery',
        task: `Process recovery message: ${userMessage}`,
      };
    } else if (currentState === 'REFLECTION') {
      agentDelegation = {
        agent: 'reflection',
        task: `Process reflection input: ${userMessage}`,
      };
    } else {
      responseToUser = "I'm here to support your learning journey. Let's head back to our coaching plan.";
      newState = 'PLANNING';
    }

    // Execute agent delegation
    if (agentDelegation) {
      try {
        if (agentDelegation.agent === 'onboarding') {
          const onboardingResult = await onboardingAgent.executeTurn(
            currentState,
            userMessage,
            CoordinatorService.onboardingSlots[userId] || {}
          );
          responseToUser = onboardingResult.response;
          newState = onboardingResult.nextState;

          if (onboardingResult.slotsFilled) {
            CoordinatorService.onboardingSlots[userId] = {
              ...CoordinatorService.onboardingSlots[userId],
              ...onboardingResult.slotsFilled,
            };
          }

          if (newState === 'PLANNING') {
            const slots = CoordinatorService.onboardingSlots[userId] || {};
            const profile: LearnerProfile = {
              id: crypto.randomUUID(),
              user_id: userId,
              primary_goal: slots.primary_goal || 'Learn a new skill',
              goal_category: slots.goal_category || 'technical',
              motivation_reasons: slots.motivation_reasons || ['Career growth'],
              past_attempts: slots.past_attempts || [],
              barriers: slots.barriers || [],
              weekly_time_budget_hours: slots.weekly_time_budget_hours || 5,
              best_time: slots.best_time || 'evening',
              preferred_formats: slots.preferred_formats || ['reading'],
              confidence_score: slots.confidence_score || 7,
              readiness_stage: slots.readiness_stage || 'action',
              success_definition: slots.success_definition || 'Consistency',
            };
            await LearnerProfileModel.create(profile);
            delete CoordinatorService.onboardingSlots[userId];
          }
        } else if (agentDelegation.agent === 'planning') {
          const profile = await LearnerProfileModel.findByUserId(userId);
          const planningResult = await planningAgent.processTurn(userMessage, profile, []);
          responseToUser = planningResult.response;

          if (planningResult.confirmed && planningResult.proposedPlan) {
            const planId = crypto.randomUUID();
            await WeeklyPlanModel.create({
              id: planId,
              user_id: userId,
              week_start: new Date().toISOString().split('T')[0],
              weekly_goal: planningResult.proposedPlan.weekly_goal,
              flexibility_note: 'Dynamic planning',
            });

            for (const s of planningResult.proposedPlan.sessions) {
              const eventId = await calendarService.createEvent(s.topic, s.scheduled_at, s.duration_minutes);
              await LearningSessionModel.create({
                id: crypto.randomUUID(),
                plan_id: planId,
                scheduled_at: s.scheduled_at,
                duration_minutes: s.duration_minutes,
                topic: s.topic,
                format: s.format,
                effort_level: s.effort_level,
                status: 'planned',
                calendar_event_id: eventId,
              });
            }

            newState = 'ACTIVE_WEEK';
          }
        } else if (agentDelegation.agent === 'recovery') {
          const currentStage = CoordinatorService.recoveryStages[userId] || 'INITIATE';
          const recoveryResult = await recoveryAgent.processTurn(userMessage, currentStage);
          responseToUser = recoveryResult.response;
          const nextStage = recoveryResult.nextStage;

          if (nextStage === 'ACTIVE_WEEK') {
            // Trigger post-recovery reflection
            const prompt = await reflectionAgent.generatePrompt('recovery_completion');
            responseToUser = prompt;
            newState = 'REFLECTION';
            CoordinatorService.activePrompts[userId] = prompt;
            delete CoordinatorService.recoveryStages[userId];
          } else {
            newState = `RECOVERY_${nextStage}`;
            CoordinatorService.recoveryStages[userId] = nextStage;
          }

          if (recoveryResult.rescheduleNeeded) {
            const plan = await WeeklyPlanModel.findLatestByUserId(userId);
            if (plan) {
              const sessions = await LearningSessionModel.findByPlanId(plan.id);
              const missedSession = sessions.find((s) => s.status === 'missed');
              if (missedSession) {
                if (missedSession.calendar_event_id) {
                  await calendarService.deleteEvent(missedSession.calendar_event_id);
                }

                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(19, 0, 0, 0);

                const newEventId = await calendarService.createEvent(
                  missedSession.topic,
                  tomorrow,
                  missedSession.duration_minutes
                );

                await LearningSessionModel.create({
                  id: crypto.randomUUID(),
                  plan_id: plan.id,
                  scheduled_at: tomorrow,
                  duration_minutes: missedSession.duration_minutes,
                  topic: missedSession.topic,
                  format: missedSession.format,
                  effort_level: missedSession.effort_level,
                  status: 'planned',
                  calendar_event_id: newEventId,
                });

                await LearningSessionModel.updateStatus(missedSession.id, 'rescheduled');
              }
            }
          }
        } else if (agentDelegation.agent === 'reflection') {
          // If first message entering reflection state (e.g. trigger is sent)
          if (userMessage.toLowerCase().includes('finished') || userMessage.toLowerCase().includes('review')) {
            const trigger = userMessage.toLowerCase().includes('review') ? 'weekly_review' : 'session_completion';
            const prompt = await reflectionAgent.generatePrompt(trigger);
            responseToUser = prompt;
            newState = 'REFLECTION';
            CoordinatorService.activePrompts[userId] = prompt;
          } else {
            // User answers or skips active prompt
            const prompt = CoordinatorService.activePrompts[userId] || 'What went well?';
            const result = await reflectionAgent.processResponse(userMessage);

            await ReflectionEntryModel.create({
              id: crypto.randomUUID(),
              user_id: userId,
              trigger_type: 'session_completion',
              prompt_text: prompt,
              response_text: result.text,
              skipped: result.skipped,
            });

            responseToUser = "We're back on track! Let me know if you need to adjust anything else.";
            newState = 'ACTIVE_WEEK';
            delete CoordinatorService.activePrompts[userId];
          }
        }
      } catch (error) {
        console.error(`Delegation to ${agentDelegation.agent} failed:`, error);
        responseToUser = "Let's keep focusing on your goals. What options feel right to you now?";
      }
    }

    // Word count limitation (150 words)
    const words = responseToUser.split(/\s+/);
    if (words.length > 150) {
      responseToUser = words.slice(0, 150).join(' ') + '...';
    }

    // Run Safety Filter
    const safetyCheck = safetyFilter.scan(responseToUser);
    if (!safetyCheck.passed) {
      responseToUser = 'I want to support you in finding a sustainable rhythm. What is one small step you can take today?';
    }

    return {
      responseToUser,
      newState,
      agentDelegation,
      safetyCheckPassed: safetyCheck.passed,
    };
  }
}

export const coordinatorService = new CoordinatorService();
