import { promptService } from '../services/prompt.service.js';
import { llmService } from '../services/llm.service.js';

export interface RecoveryResult {
  response: string;
  nextStage: string;
  rescheduleNeeded: boolean;
}

export class RecoveryAgent {
  public async processTurn(
    message: string,
    currentStage: string
  ): Promise<RecoveryResult> {
    const text = message.toLowerCase();
    const provider = llmService.getProvider();

    if (provider !== 'mock') {
      const response = await llmService.generate('recovery', `Stage: ${currentStage}, Message: ${message}`);
      let nextStage = 'EXPLORE';
      let rescheduleNeeded = false;

      if (currentStage === 'INITIATE') {
        nextStage = 'EXPLORE';
      } else if (currentStage === 'EXPLORE') {
        nextStage = 'RESOLVE';
      } else if (currentStage === 'RESOLVE') {
        nextStage = 'COMPLETE';
        if (text.includes('yes') || text.includes('sure') || text.includes('please') || text.includes('ok')) {
          rescheduleNeeded = true;
        }
      } else if (currentStage === 'COMPLETE') {
        nextStage = 'ACTIVE_WEEK';
      }

      return { response, nextStage, rescheduleNeeded };
    }

    switch (currentStage) {
      case 'INITIATE':
        return {
          response: "I noticed you missed your session. No judgment—life happens. What got in the way?",
          nextStage: 'EXPLORE',
          rescheduleNeeded: false,
        };

      case 'EXPLORE':
        return {
          response: "That's completely understandable. When energy is low, starting is the hardest part. Would you like to reschedule this session for another time?",
          nextStage: 'RESOLVE',
          rescheduleNeeded: false,
        };

      case 'RESOLVE':
        if (text.includes('yes') || text.includes('sure') || text.includes('please') || text.includes('ok')) {
          return {
            response: "Great! Rescheduled the session for tomorrow at the same time. Showing up after a miss is what consistency actually looks like.",
            nextStage: 'COMPLETE',
            rescheduleNeeded: true,
          };
        }
        return {
          response: "No problem. We can skip this one and focus on your next planned session. What feels right?",
          nextStage: 'COMPLETE',
          rescheduleNeeded: false,
        };

      case 'COMPLETE':
      default:
        return {
          response: "We're back on track! Let me know if you need to adjust anything else.",
          nextStage: 'ACTIVE_WEEK',
          rescheduleNeeded: false,
        };
    }
  }
}

export const recoveryAgent = new RecoveryAgent();
