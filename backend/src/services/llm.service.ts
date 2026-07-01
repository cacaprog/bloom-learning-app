import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from 'openai';
import { promptService } from './prompt.service.js';

export class LlmService {
  public getProvider(): 'gemini' | 'openai' | 'mock' {
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'mock-gemini-key') {
      return 'gemini';
    }
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'mock-openai-key') {
      return 'openai';
    }
    return 'mock';
  }

  public async generate(agentKey: string, userMessage: string): Promise<string> {
    const provider = this.getProvider();
    const systemPrompt = promptService.getPrompt(agentKey);

    if (provider === 'gemini') {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          systemInstruction: systemPrompt,
        });
        const result = await model.generateContent(userMessage);
        return result.response.text().trim();
      } catch (err) {
        console.error('Gemini API call failed, falling back to mock:', err);
        return this.getMockResponse(agentKey, userMessage);
      }
    } else if (provider === 'openai') {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ]
        });
        return (completion.choices[0]?.message?.content || '').trim();
      } catch (err) {
        console.error('OpenAI API call failed, falling back to mock:', err);
        return this.getMockResponse(agentKey, userMessage);
      }
    } else {
      return this.getMockResponse(agentKey, userMessage);
    }
  }

  private getMockResponse(agentKey: string, userMessage: string): string {
    const text = userMessage.toLowerCase();
    switch (agentKey) {
      case 'onboarding':
        if (text.includes('begin') || text.includes('hello')) {
          return 'What skill are you looking to learn, and what category does it fit in (e.g. technical, professional, creative, language)?';
        }
        return 'Got it. Have you tried learning this before? If so, what got in the way in your past attempts?';
      case 'planning':
        if (text.includes('confirm') || text.includes('yes') || text.includes('agree')) {
          return 'Excellent! I have confirmed your weekly plan with 3 sessions (120 mins each). I\'ve synced this to your calendar. Ready to go!';
        }
        return promptService.getPrompt('planning');
      case 'recovery':
        if (text.includes('yes') || text.includes('sure') || text.includes('please')) {
          return 'Great! Rescheduled the session for tomorrow at the same time. Showing up after a miss is what consistency actually looks like.';
        }
        return promptService.getPrompt('recovery');
      case 'reflection':
        if (text.includes('skip') || text.includes('dismiss')) {
          return 'skip';
        }
        return promptService.getPrompt('reflection');
      default:
        return 'Mock reply.';
    }
  }
}

export const llmService = new LlmService();
