import { db } from '../services/db.service.js';

export interface LearnerProfile {
  id: string;
  user_id: string;
  primary_goal: string;
  goal_category: string;
  motivation_reasons: string[];
  past_attempts: any[];
  barriers: any[];
  weekly_time_budget_hours: number | null;
  best_time: string | null;
  preferred_formats: string[];
  confidence_score: number | null;
  readiness_stage: string;
  success_definition: string;
  created_at?: Date;
  updated_at?: Date;
}

export class LearnerProfileModel {
  public static async create(profile: LearnerProfile): Promise<LearnerProfile> {
    const query = `
      INSERT INTO learner_profiles (
        id, user_id, primary_goal, goal_category, motivation_reasons, 
        past_attempts, barriers, weekly_time_budget_hours, best_time, 
        preferred_formats, confidence_score, readiness_stage, success_definition
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (user_id) DO UPDATE SET
        primary_goal = EXCLUDED.primary_goal,
        goal_category = EXCLUDED.goal_category,
        motivation_reasons = EXCLUDED.motivation_reasons,
        past_attempts = EXCLUDED.past_attempts,
        barriers = EXCLUDED.barriers,
        weekly_time_budget_hours = EXCLUDED.weekly_time_budget_hours,
        best_time = EXCLUDED.best_time,
        preferred_formats = EXCLUDED.preferred_formats,
        confidence_score = EXCLUDED.confidence_score,
        readiness_stage = EXCLUDED.readiness_stage,
        success_definition = EXCLUDED.success_definition,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const res = await db.query(query, [
      profile.id,
      profile.user_id,
      profile.primary_goal,
      profile.goal_category,
      profile.motivation_reasons,
      JSON.stringify(profile.past_attempts),
      JSON.stringify(profile.barriers),
      profile.weekly_time_budget_hours,
      profile.best_time,
      profile.preferred_formats,
      profile.confidence_score,
      profile.readiness_stage,
      profile.success_definition,
    ]);
    return res.rows[0];
  }

  public static async findByUserId(userId: string): Promise<LearnerProfile | null> {
    const query = `SELECT * FROM learner_profiles WHERE user_id = $1;`;
    const res = await db.query(query, [userId]);
    return res.rows[0] || null;
  }
}
