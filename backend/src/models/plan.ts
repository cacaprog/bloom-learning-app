import { db } from '../services/db.service.js';

export interface WeeklyPlan {
  id: string;
  user_id: string;
  week_start: string; // YYYY-MM-DD
  weekly_goal: string;
  flexibility_note: string;
  created_at?: Date;
}

export class WeeklyPlanModel {
  public static async create(plan: WeeklyPlan): Promise<WeeklyPlan> {
    const query = `
      INSERT INTO weekly_plans (id, user_id, week_start, weekly_goal, flexibility_note)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const res = await db.query(query, [
      plan.id,
      plan.user_id,
      plan.week_start,
      plan.weekly_goal,
      plan.flexibility_note,
    ]);
    return res.rows[0];
  }

  public static async findLatestByUserId(userId: string): Promise<WeeklyPlan | null> {
    const query = `
      SELECT * FROM weekly_plans
      WHERE user_id = $1
      ORDER BY week_start DESC
      LIMIT 1;
    `;
    const res = await db.query(query, [userId]);
    return res.rows[0] || null;
  }
}
