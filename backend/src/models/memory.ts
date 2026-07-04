import { db } from '../services/db.service.js';

export interface LearnerMemory {
  id: string;
  user_id: string;
  fact_type: 'preference' | 'barrier' | 'progress' | 'insight';
  content: string;
  confidence: number;
  source_agent: string;
  archived?: boolean;
  created_at?: Date;
}

export interface MemorySummary {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  summary_text: string;
  fact_count: number;
  created_at?: Date;
}

export class LearnerMemoryModel {
  public static async create(memory: Omit<LearnerMemory, 'archived' | 'created_at'>): Promise<LearnerMemory> {
    const query = `
      INSERT INTO learner_memories (id, user_id, fact_type, content, confidence, source_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const res = await db.query(query, [
      memory.id,
      memory.user_id,
      memory.fact_type,
      memory.content,
      memory.confidence,
      memory.source_agent,
    ]);
    return res.rows[0];
  }

  public static async findRecent(userId: string, days: number, limit: number): Promise<LearnerMemory[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const query = `
      SELECT * FROM learner_memories
      WHERE user_id = $1 AND created_at >= $2 AND archived = FALSE
      ORDER BY created_at DESC LIMIT $3;
    `;
    const res = await db.query(query, [userId, since, limit]);
    return res.rows;
  }

  public static async findSince(userId: string, since: Date): Promise<LearnerMemory[]> {
    const query = `
      SELECT * FROM learner_memories
      WHERE user_id = $1 AND created_at >= $2 AND archived = FALSE
      ORDER BY created_at ASC;
    `;
    const res = await db.query(query, [userId, since]);
    return res.rows;
  }

  public static async archiveOlderThan(userId: string, days: number): Promise<void> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const query = `
      UPDATE learner_memories SET archived = TRUE
      WHERE user_id = $1 AND created_at < $2 AND archived = FALSE;
    `;
    await db.query(query, [userId, cutoff]);
  }

  public static async getUsersWithPendingFacts(): Promise<string[]> {
    const query = `
      SELECT DISTINCT user_id FROM learner_memories WHERE archived = FALSE;
    `;
    const res = await db.query(query, []);
    return res.rows.map((r: any) => r.user_id);
  }
}

export class MemorySummaryModel {
  public static async create(summary: Omit<MemorySummary, 'created_at'>): Promise<MemorySummary> {
    const query = `
      INSERT INTO memory_summaries (id, user_id, period_start, period_end, summary_text, fact_count)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const res = await db.query(query, [
      summary.id,
      summary.user_id,
      summary.period_start,
      summary.period_end,
      summary.summary_text,
      summary.fact_count,
    ]);
    return res.rows[0];
  }

  public static async findLatest(userId: string): Promise<MemorySummary | null> {
    const query = `
      SELECT * FROM memory_summaries
      WHERE user_id = $1
      ORDER BY period_end DESC LIMIT 1;
    `;
    const res = await db.query(query, [userId]);
    return res.rows[0] || null;
  }
}
