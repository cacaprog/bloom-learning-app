import { db } from '../services/db.service.js';

export interface CoachMessage {
  id: string;
  user_id: string;
  session_id?: string | null;
  role: 'user' | 'coach';
  agent_id?: string | null;
  mode: string; // e.g. 'chat'
  state: string;
  strategy?: string | null;
  content: string;
  safety_check_passed?: boolean;
  created_at?: Date | string;
}

export class CoachMessageModel {
  public static async create(message: CoachMessage): Promise<CoachMessage> {
    const query = `
      INSERT INTO coach_messages (id, user_id, session_id, role, agent_id, mode, state, strategy, content, safety_check_passed)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const res = await db.query(query, [
      message.id,
      message.user_id,
      message.session_id || null,
      message.role,
      message.agent_id || null,
      message.mode,
      message.state,
      message.strategy || null,
      message.content,
      message.safety_check_passed !== undefined ? message.safety_check_passed : true,
    ]);
    return res.rows[0];
  }

  public static async findByUserId(userId: string): Promise<CoachMessage[]> {
    const query = `
      SELECT * FROM coach_messages
      WHERE user_id = $1
      ORDER BY created_at ASC;
    `;
    const res = await db.query(query, [userId]);
    return res.rows;
  }

  public static async deleteByUserId(userId: string): Promise<void> {
    const query = `
      DELETE FROM coach_messages
      WHERE user_id = $1;
    `;
    await db.query(query, [userId]);
  }
}
