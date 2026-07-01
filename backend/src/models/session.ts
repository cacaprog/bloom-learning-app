import { db } from '../services/db.service.js';

export interface LearningSession {
  id: string;
  plan_id: string;
  scheduled_at: Date;
  duration_minutes: number;
  topic: string;
  format: string;
  effort_level: string;
  status: string;
  calendar_event_id?: string;
  completed_at?: Date;
  completion_source?: string;
  notes?: string;
  created_at?: Date;
}

export class LearningSessionModel {
  public static async create(session: LearningSession): Promise<LearningSession> {
    const query = `
      INSERT INTO learning_sessions (
        id, plan_id, scheduled_at, duration_minutes, topic, 
        format, effort_level, status, calendar_event_id, 
        completed_at, completion_source, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;
    `;
    const res = await db.query(query, [
      session.id,
      session.plan_id,
      session.scheduled_at,
      session.duration_minutes,
      session.topic,
      session.format,
      session.effort_level,
      session.status,
      session.calendar_event_id,
      session.completed_at,
      session.completion_source,
      session.notes,
    ]);
    return res.rows[0];
  }

  public static async findByPlanId(planId: string): Promise<LearningSession[]> {
    const query = `SELECT * FROM learning_sessions WHERE plan_id = $1 ORDER BY scheduled_at ASC;`;
    const res = await db.query(query, [planId]);
    return res.rows;
  }

  public static async updateStatus(id: string, status: string, notes?: string, completedAt?: Date, source?: string): Promise<void> {
    const query = `
      UPDATE learning_sessions
      SET status = $2, notes = COALESCE($3, notes), completed_at = COALESCE($4, completed_at), completion_source = COALESCE($5, completion_source)
      WHERE id = $1;
    `;
    await db.query(query, [id, status, notes, completedAt, source]);
  }
}
