import { db } from '../services/db.service.js';

export interface LearnerProfile {
  id: string;
  user_id: string;
  primary_goal: string;
  goal_category: string;
  motivation_reasons: string[];
  past_attempts: any[];
  barriers: any[];
  weekly_time_budget_hours: number;
  best_time: string;
  preferred_formats: string[];
  confidence_score: number;
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
