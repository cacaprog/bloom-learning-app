import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from 'openai';
import { promptService } from './prompt.service.js';
import { TelemetryModel } from '../models/telemetry.js';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export type LlmResponse =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; id: string; name: string; args: Record<string, unknown> };

export interface ToolMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCall?: { id: string; name: string; args: Record<string, unknown> };
  toolCallId?: string;
  toolName?: string;
}

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

    const startTime = process.hrtime();
    let responseText = '';
    let inputTokens = 0;
    let outputTokens = 0;

    try {
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

          responseText = result.response.text().trim();

          const usage = result.response.usageMetadata;
          if (usage) {
            inputTokens = usage.promptTokenCount || 0;
            outputTokens = usage.candidatesTokenCount || 0;
          }
        } catch (err) {
          console.error('Gemini API call failed, falling back to mock:', err);
          responseText = this.getMockResponse(agentKey, userMessage);
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
          responseText = (completion.choices[0]?.message?.content || '').trim();

          const usage = completion.usage;
          if (usage) {
            inputTokens = usage.prompt_tokens || 0;
            outputTokens = usage.completion_tokens || 0;
          }
        } catch (err) {
          console.error('OpenAI API call failed, falling back to mock:', err);
          responseText = this.getMockResponse(agentKey, userMessage);
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
          responseText = (completion.choices[0]?.message?.content || '').trim();

          const usage = completion.usage;
          if (usage) {
            inputTokens = usage.prompt_tokens || 0;
            outputTokens = usage.completion_tokens || 0;
          }
        } catch (err) {
          console.error('Ollama API call failed, falling back to mock:', err);
          responseText = this.getMockResponse(agentKey, userMessage);
        }
      } else {
        responseText = this.getMockResponse(agentKey, userMessage);
      }
      return responseText;
    } finally {
      const diff = process.hrtime(startTime);
      const durationInMs = (diff[0] * 1e9 + diff[1]) / 1e6;
      console.log(`[Telemetry] LLM Generate - Agent: ${agentKey} - Provider: ${provider} - Duration: ${durationInMs.toFixed(2)}ms - Tokens: ${inputTokens} in / ${outputTokens} out`);

      TelemetryModel.create({
        event_type: 'llm_generation',
        name: agentKey,
        provider,
        duration_ms: Number(durationInMs.toFixed(2)),
        status: responseText ? 'success' : 'failure',
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      }).catch(err => console.error('[Telemetry] Failed to save llm_generation log:', err));
    }
  }

  public async generateWithTools(
    systemPrompt: string,
    messages: ToolMessage[],
    tools: ToolDefinition[]
  ): Promise<LlmResponse> {
    const provider = this.getProvider();
    const startTime = process.hrtime();
    let result: LlmResponse = { type: 'text', content: '' };
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      if (provider === 'openai' || provider === 'ollama') {
        try {
          const openai = provider === 'openai'
            ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
            : new OpenAI({ apiKey: 'ollama', baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1' });

          const model = provider === 'openai' ? 'gpt-4o-mini' : (process.env.OLLAMA_MODEL || 'qwen3.5:latest');

          const openaiMessages: any[] = [{ role: 'system', content: systemPrompt }];
          for (const m of messages) {
            if (m.role === 'assistant' && m.toolCall) {
              openaiMessages.push({
                role: 'assistant',
                content: null,
                tool_calls: [{
                  id: m.toolCall.id,
                  type: 'function',
                  function: { name: m.toolCall.name, arguments: JSON.stringify(m.toolCall.args) }
                }]
              });
            } else if (m.role === 'tool') {
              openaiMessages.push({ role: 'tool', content: m.content, tool_call_id: m.toolCallId });
            } else {
              openaiMessages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
            }
          }

          const completion = await openai.chat.completions.create({
            model,
            messages: openaiMessages,
            tools: tools.map(t => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters } })),
            tool_choice: 'auto'
          });

          const usage = completion.usage;
          if (usage) {
            inputTokens = usage.prompt_tokens || 0;
            outputTokens = usage.completion_tokens || 0;
          }

          const choice = completion.choices[0];
          if (choice?.message?.tool_calls?.length) {
            const tc = choice.message.tool_calls[0] as any;
            result = { type: 'tool_call', id: tc.id, name: tc.function.name, args: JSON.parse(tc.function.arguments || '{}') };
          } else {
            result = { type: 'text', content: (choice?.message?.content || '').trim() };
          }
        } catch (err) {
          console.error(`${provider} generateWithTools failed, falling back to mock:`, err);
          result = this.getMockToolResponse(systemPrompt, messages, tools);
        }
      } else if (provider === 'gemini') {
        try {
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
          const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemPrompt,
            tools: [{ functionDeclarations: tools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters as any })) }]
          });

          const contents: any[] = messages.map(m => {
            if (m.role === 'assistant' && m.toolCall) {
              return { role: 'model', parts: [{ functionCall: { name: m.toolCall.name, args: m.toolCall.args } }] };
            }
            if (m.role === 'tool') {
              return { role: 'user', parts: [{ functionResponse: { name: m.toolName, response: { output: m.content } } }] };
            }
            return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] };
          });

          const geminiResult = await model.generateContent({ contents });
          const functionCalls = geminiResult.response.functionCalls();

          const usage = geminiResult.response.usageMetadata;
          if (usage) {
            inputTokens = usage.promptTokenCount || 0;
            outputTokens = usage.candidatesTokenCount || 0;
          }

          if (functionCalls?.length) {
            const fc = functionCalls[0];
            result = { type: 'tool_call', id: fc.name, name: fc.name, args: fc.args as Record<string, unknown> };
          } else {
            result = { type: 'text', content: geminiResult.response.text().trim() };
          }
        } catch (err) {
          console.error('Gemini generateWithTools failed, falling back to mock:', err);
          result = this.getMockToolResponse(systemPrompt, messages, tools);
        }
      } else {
        result = this.getMockToolResponse(systemPrompt, messages, tools);
      }

      return result;
    } finally {
      const diff = process.hrtime(startTime);
      const durationInMs = (diff[0] * 1e9 + diff[1]) / 1e6;
      const toolName = result.type === 'tool_call' ? result.name : 'text';
      console.log(`[Telemetry] LLM Tool Call - Tool: ${toolName} - Provider: ${provider} - Duration: ${durationInMs.toFixed(2)}ms - Tokens: ${inputTokens} in / ${outputTokens} out`);

      TelemetryModel.create({
        event_type: 'llm_generation',
        name: `tool:${toolName}`,
        provider,
        duration_ms: Number(durationInMs.toFixed(2)),
        status: 'success',
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      }).catch(err => console.error('[Telemetry] Failed to save tool call log:', err));
    }
  }

  private getMockToolResponse(systemPrompt: string, messages: ToolMessage[], tools: ToolDefinition[]): LlmResponse {
    const toolNames = tools.map(t => t.name);
    const hasDelegate = toolNames.includes('delegate');
    const hasConfirmPlan = toolNames.includes('confirm_plan');
    const toolResults = messages.filter(m => m.role === 'tool');
    const userMessages = messages.filter(m => m.role === 'user');
    const lastUserContent = userMessages[userMessages.length - 1]?.content?.toLowerCase() || '';

    if (hasConfirmPlan) {
      // Planning ReAct loop mode
      const isConfirming = lastUserContent.includes('confirm') || lastUserContent.includes('yes') || lastUserContent.includes('agree') || lastUserContent.includes('/confirm-plan');
      if (toolResults.length === 0) {
        if (isConfirming) {
          return { type: 'tool_call', id: 'mock-plan-1', name: 'get_free_busy', args: {} };
        }
        return { type: 'text', content: "Here's a starting point — a few sessions spread through the week. Does that rhythm feel right, or would you prefer to adjust?" };
      }
      // After get_free_busy: call confirm_plan
      const base = new Date();
      const sessions = Array.from({ length: 3 }, (_, i) => {
        const d = new Date(base);
        d.setDate(d.getDate() + (i + 1) * 2);
        d.setHours(19, 0, 0, 0);
        return { title: `Study session ${i + 1}`, scheduled_at: d.toISOString(), duration_minutes: 60 };
      });
      return { type: 'tool_call', id: 'mock-plan-2', name: 'confirm_plan', args: { weekly_goal: 'Complete weekly study sessions', sessions } };
    }

    if (hasDelegate) {
      // Coordinator routing mode — extract the actual current state from the prompt
      const stateMatch = systemPrompt.match(/Current conversation state:\s*\*{0,2}(\w+)\*{0,2}/i);
      const currentState = stateMatch ? stateMatch[1].toUpperCase() : 'PLANNING';

      if (toolResults.length === 0) {
        let agent = 'planning';
        if (currentState.startsWith('ONBOARDING') || currentState === 'NEW_USER') agent = 'onboarding';
        else if (currentState.startsWith('RECOVERY')) agent = 'recovery';
        else if (currentState === 'REFLECTION') agent = 'reflection';
        return { type: 'tool_call', id: 'mock-coord-1', name: 'delegate', args: { agent, reason: `Routing to ${agent} specialist` } };
      }
      // After delegation: respond with specialist result
      const lastTool = toolResults[toolResults.length - 1];
      let specialistResponse = lastTool.content;
      let suggestedState = 'PLANNING';
      try {
        const parsed = JSON.parse(lastTool.content);
        specialistResponse = parsed.response || lastTool.content;
        suggestedState = parsed.suggested_state || 'PLANNING';
      } catch {
        // content was not JSON
      }
      return { type: 'tool_call', id: 'mock-coord-2', name: 'respond', args: { message: specialistResponse, new_state: suggestedState } };
    }

    return { type: 'text', content: "I'm here to help. What would you like to do?" };
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
          return "Great — locking that in. Sessions scheduled and added to your calendar.";
        }
        return "Here's a starting point for your weekly sessions. Does that rhythm feel right, or would you prefer to adjust?";
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
