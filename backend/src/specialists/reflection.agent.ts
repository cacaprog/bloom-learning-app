import { promptService } from '../services/prompt.service.js';

export interface ReflectionResult {
  prompt: string;
  nextState: string;
  skipped: boolean;
}

export class ReflectionAgent {
  public async generatePrompt(triggerType: string): Promise<string> {
    const loadedPrompt = promptService.getPrompt('reflection');
    if (loadedPrompt.includes('win') || loadedPrompt.includes('win this week')) {
      return loadedPrompt;
    }

    switch (triggerType) {
      case 'session_completion':
        return 'What went well in this session? What made starting feel easy?';
      case 'recovery_completion':
        return 'Showing up after a miss is key. What helped you return today?';
      case 'weekly_review':
      default:
        return 'What felt like a win this week? What rhythm worked best?';
    }
  }

  public async processResponse(message: string): Promise<{ text: string | null; skipped: boolean }> {
    const text = message.trim();
    if (text.toLowerCase() === 'skip' || text.toLowerCase() === 'dismiss') {
      return { text: null, skipped: true };
    }
    return { text, skipped: false };
  }
}

export const reflectionAgent = new ReflectionAgent();
