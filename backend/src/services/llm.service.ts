import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from 'openai';
import { promptService } from './prompt.service.js';

export class LlmService {
  public getProvider(): 'gemini' | 'openai' | 'ollama' | 'mock' {
    if (process.env.OLLAMA_MODEL) {
      return 'ollama';
    }
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'mock-gemini-key') {
      return 'gemini';
    }
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'mock-openai-key') {
      return 'openai';
    }
    return 'mock';
  }

  public async generate(agentKeyOrPrompt: string, userMessage: string, history: any[] = []): Promise<string> {
    const provider = this.getProvider();
    const isKey = ['onboarding', 'planning', 'recovery', 'reflection'].includes(agentKeyOrPrompt);
    const agentKey = isKey ? agentKeyOrPrompt : 'planning';
    const systemPrompt = isKey ? promptService.getPrompt(agentKeyOrPrompt) : agentKeyOrPrompt;

    if (provider === 'gemini') {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt,
        });

        let result;
        if (history && history.length > 0) {
          const geminiHistory = history.map(h => ({
            role: h.role === 'coach' ? 'model' : 'user',
            parts: [{ text: h.content }]
          }));
          const chat = model.startChat({ history: geminiHistory });
          result = await chat.sendMessage(userMessage);
        } else {
          result = await model.generateContent(userMessage);
        }

        return result.response.text().trim();
      } catch (err) {
        console.error('Gemini API call failed, falling back to mock:', err);
        return this.getMockResponse(agentKey, userMessage);
      }
    } else if (provider === 'openai') {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
        const mappedHistory = (history || []).map(h => ({
          role: (h.role === 'coach' ? 'assistant' : 'user') as 'assistant' | 'user',
          content: h.content
        }));
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...mappedHistory,
            { role: 'user', content: userMessage }
          ]
        });
        return (completion.choices[0]?.message?.content || '').trim();
      } catch (err) {
        console.error('OpenAI API call failed, falling back to mock:', err);
        return this.getMockResponse(agentKey, userMessage);
      }
    } else if (provider === 'ollama') {
      try {
        const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
        const modelName = process.env.OLLAMA_MODEL || 'qwen3.5:latest';
        const openai = new OpenAI({
          apiKey: 'ollama',
          baseURL: ollamaBaseUrl,
        });
        const mappedHistory = (history || []).map(h => ({
          role: (h.role === 'coach' ? 'assistant' : 'user') as 'assistant' | 'user',
          content: h.content
        }));
        const completion = await openai.chat.completions.create({
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            ...mappedHistory,
            { role: 'user', content: userMessage }
          ]
        });
        return (completion.choices[0]?.message?.content || '').trim();
      } catch (err) {
        console.error('Ollama API call failed, falling back to mock:', err);
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
        return "I noticed you missed your session. No judgment—life happens. What got in the way?";
      case 'reflection':
        if (text.includes('skip') || text.includes('dismiss')) {
          return 'skip';
        }
        if (text.includes('weekly_review')) {
          return 'What felt like a win this week? What rhythm worked best?';
        }
        if (text.includes('recovery_completion')) {
          return 'Showing up after a miss is key. What helped you return today?';
        }
        return 'What went well in this session? What made starting feel easy?';
      default:
        return "I'm ready to assist you. What can I help with?";
    }
  }
}

export const llmService = new LlmService();
