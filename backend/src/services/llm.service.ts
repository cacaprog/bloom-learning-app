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
        const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const model = genAI.getGenerativeModel({
          model: modelName,
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
      case 'onboarding': {
        const stateMatch = userMessage.match(/Current State:\s*(\w+)/);
        const state = stateMatch ? stateMatch[1] : 'ONBOARDING_S1';
        switch (state) {
          case 'ONBOARDING_S1':
            return "What skill are you looking to learn, and what category does it fit in (e.g. technical, professional, creative, language)?";
          case 'ONBOARDING_S2':
            return "Got it. Have you tried learning this before? If so, what got in the way in your past attempts?";
          case 'ONBOARDING_S3':
            return "That's common. How many hours a week can you realistically protect for this, and when do you feel most focused (morning, midday, evening)?";
          case 'ONBOARDING_S4':
            return "Understood. On a scale of 1 to 10, how confident do you feel about sticking to this schedule?";
          case 'ONBOARDING_S5':
            return "Thank you. Let me summarize your profile: You want to learn this skill to achieve your goals, scheduling it for your preferred times. Do you confirm this outline?";
          case 'ONBOARDING_S6':
            return "Excellent! Your learner profile is confirmed. Let's start co-creating your weekly plan.";
          default:
            return "What skill are you looking to learn, and what category does it fit in (e.g. technical, professional, creative, language)?";
        }
      }
      case 'planning':
        if (text.includes('confirm') || text.includes('yes') || text.includes('agree')) {
          return "Excellent! I have confirmed your weekly plan with 3 sessions. I've synced this to your calendar. Ready to go!";
        }
        return "I've drafted a learning plan based on your onboarding profile. It includes 3 focus sessions scheduled throughout the week during your preferred times. Would you like to confirm this plan or make changes?";
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
        return "I'm ready to assist you. What can I help with?";
    }
  }
}

export const llmService = new LlmService();
