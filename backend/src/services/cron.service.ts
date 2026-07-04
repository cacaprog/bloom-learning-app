import { db } from './db.service.js';
import { LearningSessionModel } from '../models/session.js';
import { LearnerMemoryModel } from '../models/memory.js';
import { memoryService } from './memory.service.js';

export async function checkMissedSessions(): Promise<number> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  // Find planned sessions past grace period
  const query = `
    SELECT ls.*, wp.user_id 
    FROM learning_sessions ls
    JOIN weekly_plans wp ON ls.plan_id = wp.id
    WHERE ls.status = 'planned' AND ls.scheduled_at <= $1;
  `;
  const res = await db.query(query, [twoHoursAgo]);

  let missedCount = 0;
  for (const row of res.rows) {
    // Update session status to missed
    await LearningSessionModel.updateStatus(row.id, 'missed', 'Automatically marked missed by cron check');
    missedCount++;
  }

  return missedCount;
}

export async function summarizeActiveUsers(): Promise<number> {
  const userIds = await LearnerMemoryModel.getUsersWithPendingFacts();
  let count = 0;
  for (const userId of userIds) {
    await memoryService.summarize(userId);
    count++;
  }
  return count;
}
