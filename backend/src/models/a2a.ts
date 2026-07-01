import { db } from '../services/db.service.js';

export interface A2ATask {
  id: string;
  user_id: string;
  skill_id: string;
  external_caller: string;
  state: 'submitted' | 'working' | 'input-required' | 'completed' | 'failed';
  input_message: any;
  artifact?: any;
  created_at?: Date;
  updated_at?: Date;
}

export class A2ATaskModel {
  public static async create(task: A2ATask): Promise<A2ATask> {
    const query = `
      INSERT INTO a2a_tasks (id, user_id, skill_id, external_caller, state, input_message, artifact)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const res = await db.query(query, [
      task.id,
      task.user_id,
      task.skill_id,
      task.external_caller,
      task.state,
      JSON.stringify(task.input_message),
      task.artifact ? JSON.stringify(task.artifact) : null,
    ]);
    return res.rows[0];
  }

  public static async updateState(id: string, state: string, artifact?: any): Promise<void> {
    const query = `
      UPDATE a2a_tasks
      SET state = $2, artifact = COALESCE($3, artifact), updated_at = CURRENT_TIMESTAMP
      WHERE id = $1;
    `;
    await db.query(query, [id, state, artifact ? JSON.stringify(artifact) : null]);
  }

  public static async findById(id: string): Promise<A2ATask | null> {
    const query = `SELECT * FROM a2a_tasks WHERE id = $1;`;
    const res = await db.query(query, [id]);
    return res.rows[0] || null;
  }
}
