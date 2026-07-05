import { MemoryService } from '../../src/services/memory.service.js';
import { LearnerMemoryModel, MemorySummaryModel } from '../../src/models/memory.js';
import { LearnerProfileModel } from '../../src/models/profile.js';
import { llmService } from '../../src/services/llm.service.js';

jest.mock('../../src/services/llm.service.js', () => ({
  llmService: { generate: jest.fn() },
}));

jest.mock('../../src/models/memory.js', () => ({
  LearnerMemoryModel: {
    create: jest.fn(),
    findRecent: jest.fn(),
    findSince: jest.fn(),
    archiveOlderThan: jest.fn(),
    getUsersWithPendingFacts: jest.fn(),
  },
  MemorySummaryModel: {
    create: jest.fn(),
    findLatest: jest.fn(),
  },
}));

jest.mock('../../src/models/profile.js', () => ({
  LearnerProfileModel: {
    findByUserId: jest.fn(),
  },
}));

describe('MemoryService Unit Tests', () => {
  let service: MemoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MemoryService();
    (LearnerMemoryModel.findRecent as jest.Mock).mockResolvedValue([]);
    (LearnerMemoryModel.findSince as jest.Mock).mockResolvedValue([]);
    (LearnerMemoryModel.create as jest.Mock).mockResolvedValue({});
    (LearnerMemoryModel.archiveOlderThan as jest.Mock).mockResolvedValue(undefined);
    (MemorySummaryModel.findLatest as jest.Mock).mockResolvedValue(null);
    (MemorySummaryModel.create as jest.Mock).mockResolvedValue({});
  });

  describe('buildContext', () => {
    it('returns empty string when no profile found', async () => {
      (LearnerProfileModel.findByUserId as jest.Mock).mockResolvedValue(null);

      const result = await service.buildContext('user-1');

      expect(result).toBe('');
    });

    it('returns formatted context with profile and recent facts', async () => {
      (LearnerProfileModel.findByUserId as jest.Mock).mockResolvedValue({
        primary_goal: 'Learn Spanish',
        goal_category: 'language',
        weekly_time_budget_hours: 5,
        best_time: 'morning',
        confidence_score: 8,
      });
      (LearnerMemoryModel.findRecent as jest.Mock).mockResolvedValue([
        { fact_type: 'preference', content: 'Prefers short sessions' },
        { fact_type: 'barrier', content: 'Struggles with mornings' },
      ]);

      const result = await service.buildContext('user-1');

      expect(result).toContain('## Learner Context');
      expect(result).toContain('Learn Spanish');
      expect(result).toContain('language');
      expect(result).toContain('5h/week');
      expect(result).toContain('morning');
      expect(result).toContain('8/10');
      expect(result).toContain('**Recent patterns:**');
      expect(result).toContain('[preference] Prefers short sessions');
      expect(result).toContain('[barrier] Struggles with mornings');
    });

    it('includes historical summary section when present', async () => {
      (LearnerProfileModel.findByUserId as jest.Mock).mockResolvedValue({
        primary_goal: 'Learn Piano',
        goal_category: 'creative',
        weekly_time_budget_hours: 3,
        best_time: 'evening',
        confidence_score: 6,
      });
      (MemorySummaryModel.findLatest as jest.Mock).mockResolvedValue({
        period_start: '2026-06-01',
        period_end: '2026-06-30',
        summary_text: 'Learner showed consistent evening practice.',
      });

      const result = await service.buildContext('user-1');

      expect(result).toContain('**Historical summary (2026-06-01 – 2026-06-30):**');
      expect(result).toContain('Learner showed consistent evening practice.');
    });

    it('omits recent patterns section when no recent facts', async () => {
      (LearnerProfileModel.findByUserId as jest.Mock).mockResolvedValue({
        primary_goal: 'Code daily',
        goal_category: 'technical',
        weekly_time_budget_hours: 2,
        best_time: 'evening',
        confidence_score: 5,
      });
      // findRecent returns [] by default

      const result = await service.buildContext('user-1');

      expect(result).toContain('## Learner Context');
      expect(result).not.toContain('**Recent patterns:**');
    });

    it('omits null profile fields instead of leaking the literal "null" (spec 003-onboarding-stage-completeness)', async () => {
      (LearnerProfileModel.findByUserId as jest.Mock).mockResolvedValue({
        primary_goal: 'Learn guitar',
        goal_category: 'creative',
        weekly_time_budget_hours: null,
        best_time: null,
        confidence_score: null,
      });

      const result = await service.buildContext('user-1');

      expect(result).toContain('Learn guitar');
      expect(result).toContain('creative');
      expect(result).not.toContain('null');
    });
  });

  describe('extractAndStore', () => {
    it('parses LLM JSON and stores valid facts', async () => {
      (llmService.generate as jest.Mock).mockResolvedValue(
        '[{"fact_type":"preference","content":"Likes morning sessions","confidence":0.9}]'
      );

      service.extractAndStore(
        'user-2',
        [
          { role: 'user', content: 'I prefer mornings' },
          { role: 'coach', content: 'Morning sessions it is!' },
        ],
        'planning'
      );

      await new Promise(resolve => setImmediate(resolve));

      expect(llmService.generate).toHaveBeenCalledTimes(1);
      expect(LearnerMemoryModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fact_type: 'preference',
          content: 'Likes morning sessions',
          confidence: 0.9,
          source_agent: 'planning',
        })
      );
    });

    it('silently skips when LLM returns non-JSON text', async () => {
      (llmService.generate as jest.Mock).mockResolvedValue(
        "Here's a starting point for your weekly sessions."
      );

      service.extractAndStore('user-3', [{ role: 'user', content: 'test' }], 'planning');

      await new Promise(resolve => setImmediate(resolve));

      expect(LearnerMemoryModel.create).not.toHaveBeenCalled();
    });

    it('strips markdown code fences from JSON response', async () => {
      (llmService.generate as jest.Mock).mockResolvedValue(
        '```json\n[{"fact_type":"insight","content":"Motivated by progress","confidence":0.8}]\n```'
      );

      service.extractAndStore(
        'user-4',
        [{ role: 'user', content: 'I love tracking progress' }],
        'reflection'
      );

      await new Promise(resolve => setImmediate(resolve));

      expect(LearnerMemoryModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ fact_type: 'insight', content: 'Motivated by progress' })
      );
    });

    it('skips facts with invalid fact_type', async () => {
      (llmService.generate as jest.Mock).mockResolvedValue(
        '[{"fact_type":"mood","content":"Felt happy","confidence":0.5},{"fact_type":"progress","content":"Completed chapter 2","confidence":0.9}]'
      );

      service.extractAndStore('user-5', [{ role: 'user', content: 'test' }], 'planning');

      await new Promise(resolve => setImmediate(resolve));

      expect(LearnerMemoryModel.create).toHaveBeenCalledTimes(1);
      expect(LearnerMemoryModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ fact_type: 'progress', content: 'Completed chapter 2' })
      );
    });
  });

  describe('summarize', () => {
    it('skips when fewer than 5 unsummarized facts exist', async () => {
      (LearnerMemoryModel.findSince as jest.Mock).mockResolvedValue([
        { fact_type: 'preference', content: 'Fact 1' },
        { fact_type: 'preference', content: 'Fact 2' },
      ]);

      await service.summarize('user-6');

      expect(llmService.generate).not.toHaveBeenCalled();
      expect(MemorySummaryModel.create).not.toHaveBeenCalled();
    });

    it('creates summary and archives old facts when 5+ facts exist', async () => {
      (LearnerMemoryModel.findSince as jest.Mock).mockResolvedValue(
        Array.from({ length: 6 }, (_, i) => ({ fact_type: 'preference', content: `Fact ${i + 1}` }))
      );
      (llmService.generate as jest.Mock).mockResolvedValue(
        'User consistently prefers morning study sessions.'
      );

      await service.summarize('user-6');

      expect(MemorySummaryModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-6',
          summary_text: 'User consistently prefers morning study sessions.',
          fact_count: 6,
        })
      );
      expect(LearnerMemoryModel.archiveOlderThan).toHaveBeenCalledWith('user-6', 30);
    });

    it('uses latest summary period_end as the since date', async () => {
      (MemorySummaryModel.findLatest as jest.Mock).mockResolvedValue({
        period_end: '2026-06-01',
      });
      (LearnerMemoryModel.findSince as jest.Mock).mockResolvedValue([]);

      await service.summarize('user-7');

      const since = (LearnerMemoryModel.findSince as jest.Mock).mock.calls[0][1];
      expect(since).toEqual(new Date('2026-06-01'));
    });
  });
});
