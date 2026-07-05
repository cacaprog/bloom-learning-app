import crypto from 'crypto';
import { LearnerProfileModel } from '../models/profile.js';
import { LearnerMemoryModel, MemorySummaryModel } from '../models/memory.js';
import { llmService } from './llm.service.js';

const EXTRACTION_PROMPT = `Extract learning facts from this coaching conversation for long-term memory.
Return ONLY a JSON array (no other text). Maximum 3 items. Return [] if nothing noteworthy.
Format: [{"fact_type":"preference"|"barrier"|"progress"|"insight","content":"concise sentence","confidence":0.1-1.0}]
Include only facts useful to a coach in future sessions. Skip greetings, confirmations, and one-time logistics.`;

const SUMMARIZATION_PROMPT = `Compress these learner coaching facts into a concise narrative (3–5 sentences).
Cover: scheduling patterns, recurring barriers, confidence trends, and any notable insights.
Be specific. Use past tense. No bullet points or headers. Write as a coach briefing a colleague.
Facts to summarize:`;

const MIN_FACTS_TO_SUMMARIZE = 5;
const RECENT_DAYS = 14;
const RECENT_LIMIT = 10;
const ARCHIVE_AFTER_DAYS = 30;

function stripJsonMarkdown(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

export class MemoryService {
  public async buildContext(userId: string): Promise<string> {
    const [profile, recentFacts, latestSummary] = await Promise.all([
      LearnerProfileModel.findByUserId(userId),
      LearnerMemoryModel.findRecent(userId, RECENT_DAYS, RECENT_LIMIT),
      MemorySummaryModel.findLatest(userId),
    ]);

    if (!profile) return '';

    const details = [
      profile.weekly_time_budget_hours != null ? `${profile.weekly_time_budget_hours}h/week` : null,
      profile.best_time != null ? `best time: ${profile.best_time}` : null,
      profile.confidence_score != null ? `confidence: ${profile.confidence_score}/10` : null,
    ].filter((d): d is string => d != null);

    const goalLine = `**Goal:** ${profile.primary_goal} (${profile.goal_category})`
      + (details.length > 0 ? ` · ${details.join(' · ')}` : '');

    const parts: string[] = [`## Learner Context\n${goalLine}`];

    if (recentFacts.length > 0) {
      const lines = recentFacts.map(f => `- [${f.fact_type}] ${f.content}`).join('\n');
      parts.push(`**Recent patterns:**\n${lines}`);
    }

    if (latestSummary) {
      parts.push(`**Historical summary (${latestSummary.period_start} – ${latestSummary.period_end}):**\n${latestSummary.summary_text}`);
    }

    return parts.join('\n\n');
  }

  public extractAndStore(userId: string, messages: any[], agentName: string): void {
    const run = async () => {
      const conversation = messages
        .map(m => `${m.role === 'coach' ? 'coach' : 'learner'}: ${m.content}`)
        .join('\n');

      const raw = await llmService.generate(EXTRACTION_PROMPT, conversation, []);
      const cleaned = stripJsonMarkdown(raw);

      let facts: Array<{ fact_type: string; content: string; confidence: number }>;
      try {
        facts = JSON.parse(cleaned);
        if (!Array.isArray(facts)) return;
      } catch {
        return; // malformed LLM output — silent skip
      }

      const validTypes = new Set(['preference', 'barrier', 'progress', 'insight']);
      for (const fact of facts) {
        if (!fact.fact_type || !fact.content || !validTypes.has(fact.fact_type)) continue;
        await LearnerMemoryModel.create({
          id: crypto.randomUUID(),
          user_id: userId,
          fact_type: fact.fact_type as 'preference' | 'barrier' | 'progress' | 'insight',
          content: String(fact.content).slice(0, 500),
          confidence: Math.min(1.0, Math.max(0.0, Number(fact.confidence) || 0.8)),
          source_agent: agentName,
        });
      }
    };

    run().catch(err => console.error('[Memory] Extraction failed:', err));
  }

  public async summarize(userId: string): Promise<void> {
    const latestSummary = await MemorySummaryModel.findLatest(userId);
    const since = latestSummary ? new Date(latestSummary.period_end) : new Date(0);

    const facts = await LearnerMemoryModel.findSince(userId, since);
    if (facts.length < MIN_FACTS_TO_SUMMARIZE) return;

    const factLines = facts.map(f => `[${f.fact_type}] ${f.content}`).join('\n');
    const summaryText = await llmService.generate(SUMMARIZATION_PROMPT, factLines, []);

    await MemorySummaryModel.create({
      id: crypto.randomUUID(),
      user_id: userId,
      period_start: since.toISOString().split('T')[0],
      period_end: new Date().toISOString().split('T')[0],
      summary_text: summaryText.trim(),
      fact_count: facts.length,
    });

    await LearnerMemoryModel.archiveOlderThan(userId, ARCHIVE_AFTER_DAYS);
  }
}

export const memoryService = new MemoryService();
