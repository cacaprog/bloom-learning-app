import { db } from '../services/db.service.js';

export interface ReflectionEntry {
  id: string;
  user_id: string;
  trigger_type: 'session_completion' | 'weekly_review' | 'recovery_completion';
  prompt_text: string;
  response_text: string | null;
  skipped: boolean;
  created_at?: Date;
}

export class ReflectionEntryModel {
  public static async create(entry: ReflectionEntry): Promise<ReflectionEntry> {
    const query = `
      INSERT INTO reflection_entries (id, user_id, trigger_type, prompt_text, response_text, skipped)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const res = await db.query(query, [
      entry.id,
      entry.user_id,
      entry.trigger_type,
      entry.prompt_text,
      entry.response_text,
      entry.skipped,
    ]);
    return res.rows[0];
  }

  public static async findByUserId(userId: string): Promise<ReflectionEntry[]> {
    const query = `
      SELECT * FROM reflection_entries
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;
    const res = await db.query(query, [userId]);
    return res.rows;
  }
}
