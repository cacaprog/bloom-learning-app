import crypto from 'crypto';
import { memoryService } from '../../src/services/memory.service.js';
import { LearnerMemoryModel, MemorySummaryModel } from '../../src/models/memory.js';
import { LearnerProfileModel } from '../../src/models/profile.js';
import { llmService } from '../../src/services/llm.service.js';

jest.mock('../../src/services/llm.service.js', () => ({
  llmService: {
    generate: jest.fn().mockResolvedValue('[]'),
    getProvider: jest.fn().mockReturnValue('mock'),
  },
}));

function makeProfile(userId: string) {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    primary_goal: 'Master TypeScript',
    goal_category: 'technical',
    motivation_reasons: ['Career growth'],
    past_attempts: [],
    barriers: ['Limited time'],
    weekly_time_budget_hours: 6,
    best_time: 'evening',
    preferred_formats: ['reading'],
    confidence_score: 7,
    readiness_stage: 'action',
    success_definition: 'Build a project',
  };
}

describe('Memory Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (llmService.generate as jest.Mock).mockResolvedValue('[]');
  });

  describe('buildContext', () => {
    it('returns empty string for user with no profile', async () => {
      const result = await memoryService.buildContext(crypto.randomUUID());
      expect(result).toBe('');
    });

    it('returns formatted context with profile, no facts', async () => {
      const userId = crypto.randomUUID();
      await LearnerProfileModel.create(makeProfile(userId));

      const result = await memoryService.buildContext(userId);

      expect(result).toContain('## Learner Context');
      expect(result).toContain('Master TypeScript');
      expect(result).toContain('technical');
      expect(result).toContain('6h/week');
      expect(result).toContain('evening');
      expect(result).toContain('7/10');
      expect(result).not.toContain('**Recent patterns:**');
    });

    it('includes recent facts in context when present', async () => {
      const userId = crypto.randomUUID();
      await LearnerProfileModel.create(makeProfile(userId));

      await LearnerMemoryModel.create({
        id: crypto.randomUUID(),
        user_id: userId,
        fact_type: 'preference',
        content: 'Prefers evening coding sessions',
        confidence: 0.9,
        source_agent: 'planning',
      });
      await LearnerMemoryModel.create({
        id: crypto.randomUUID(),
        user_id: userId,
        fact_type: 'barrier',
        content: 'Gets distracted by notifications',
        confidence: 0.8,
        source_agent: 'recovery',
      });

      const result = await memoryService.buildContext(userId);

      expect(result).toContain('**Recent patterns:**');
      expect(result).toContain('[preference] Prefers evening coding sessions');
      expect(result).toContain('[barrier] Gets distracted by notifications');
    });

    it('includes historical summary when one exists', async () => {
      const userId = crypto.randomUUID();
      await LearnerProfileModel.create(makeProfile(userId));

      await MemorySummaryModel.create({
        id: crypto.randomUUID(),
        user_id: userId,
        period_start: '2026-05-01',
        period_end: '2026-05-31',
        summary_text: 'Learner consistently showed up in the evenings.',
        fact_count: 8,
      });

      const result = await memoryService.buildContext(userId);

      expect(result).toContain('**Historical summary (2026-05-01 – 2026-05-31):**');
      expect(result).toContain('Learner consistently showed up in the evenings.');
    });
  });

  describe('summarize', () => {
    it('skips when fewer than 5 facts exist since last summary', async () => {
      const userId = crypto.randomUUID();

      for (let i = 0; i < 3; i++) {
        await LearnerMemoryModel.create({
          id: crypto.randomUUID(),
          user_id: userId,
          fact_type: 'preference',
          content: `Fact ${i + 1}`,
          confidence: 0.8,
          source_agent: 'planning',
        });
      }

      await memoryService.summarize(userId);

      expect(llmService.generate).not.toHaveBeenCalled();
      const summary = await MemorySummaryModel.findLatest(userId);
      expect(summary).toBeNull();
    });

    it('creates a summary when 5+ facts exist', async () => {
      const userId = crypto.randomUUID();
      (llmService.generate as jest.Mock).mockResolvedValue(
        'Learner prefers evening sessions and struggles with distractions.'
      );

      for (let i = 0; i < 6; i++) {
        await LearnerMemoryModel.create({
          id: crypto.randomUUID(),
          user_id: userId,
          fact_type: 'preference',
          content: `Preference note ${i + 1}`,
          confidence: 0.85,
          source_agent: 'planning',
        });
      }

      await memoryService.summarize(userId);

      expect(llmService.generate).toHaveBeenCalledTimes(1);

      const summary = await MemorySummaryModel.findLatest(userId);
      expect(summary).not.toBeNull();
      expect(summary!.summary_text).toBe(
        'Learner prefers evening sessions and struggles with distractions.'
      );
      expect(summary!.fact_count).toBe(6);
    });

    it('summary appears in buildContext output after being created', async () => {
      const userId = crypto.randomUUID();
      await LearnerProfileModel.create(makeProfile(userId));

      (llmService.generate as jest.Mock).mockResolvedValue('Consistent evening learner.');

      for (let i = 0; i < 5; i++) {
        await LearnerMemoryModel.create({
          id: crypto.randomUUID(),
          user_id: userId,
          fact_type: 'progress',
          content: `Progress note ${i + 1}`,
          confidence: 0.75,
          source_agent: 'planning',
        });
      }

      await memoryService.summarize(userId);

      // Reset the mock so buildContext doesn't pick up the summarize call
      (llmService.generate as jest.Mock).mockResolvedValue('[]');

      const context = await memoryService.buildContext(userId);

      expect(context).toContain('Consistent evening learner.');
    });
  });
});
