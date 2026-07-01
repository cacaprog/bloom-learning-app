import pg from 'pg';

// In-memory data store for testing environments
const tables: Record<string, any[]> = {
  users: [],
  learner_profiles: [],
  weekly_plans: [],
  learning_sessions: [],
  coach_messages: [],
  agent_delegations: [],
  a2a_tasks: [],
  reflection_entries: [],
};

async function mockQuery(text: string, params?: any[]) {
  const queryText = text.trim().toLowerCase().replace(/\s+/g, ' ');

  if (queryText.includes('insert into users')) {
    const user = { id: params![0], email: params![1], timezone: params![2] || 'UTC' };
    tables.users.push(user);
    return { rows: [user] };
  }

  if (queryText.includes('select * from users where id =')) {
    const user = tables.users.find((u) => u.id === params![0]);
    return { rows: user ? [user] : [] };
  }

  if (queryText.includes('insert into learner_profiles')) {
    const profile = {
      id: params![0],
      user_id: params![1],
      primary_goal: params![2],
      goal_category: params![3],
      motivation_reasons: params![4],
      past_attempts: JSON.parse(params![5] || '[]'),
      barriers: JSON.parse(params![6] || '[]'),
      weekly_time_budget_hours: params![7],
      best_time: params![8],
      preferred_formats: params![9],
      confidence_score: params![10],
      readiness_stage: params![11],
      success_definition: params![12],
    };
    tables.learner_profiles.push(profile);
    return { rows: [profile] };
  }

  if (queryText.includes('select * from learner_profiles where user_id =')) {
    const profile = tables.learner_profiles.find((p) => p.user_id === params![0]);
    return { rows: profile ? [profile] : [] };
  }

  if (queryText.includes('insert into weekly_plans')) {
    const plan = {
      id: params![0],
      user_id: params![1],
      week_start: params![2],
      weekly_goal: params![3],
      flexibility_note: params![4],
    };
    tables.weekly_plans.push(plan);
    return { rows: [plan] };
  }

  if (queryText.includes('select * from weekly_plans') && queryText.includes('order by week_start desc')) {
    const userPlans = tables.weekly_plans.filter((p) => p.user_id === params![0]);
    userPlans.sort((a, b) => b.week_start.localeCompare(a.week_start));
    return { rows: userPlans };
  }

  if (queryText.includes('insert into learning_sessions')) {
    const session = {
      id: params![0],
      plan_id: params![1],
      scheduled_at: params![2],
      duration_minutes: params![3],
      topic: params![4],
      format: params![5],
      effort_level: params![6],
      status: params![7],
      calendar_event_id: params![8],
      completed_at: params![9],
      completion_source: params![10],
      notes: params![11],
    };
    tables.learning_sessions.push(session);
    return { rows: [session] };
  }

  if (queryText.includes('select * from learning_sessions where plan_id =')) {
    const sessions = tables.learning_sessions.filter((s) => s.plan_id === params![0]);
    sessions.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    return { rows: sessions };
  }

  if (queryText.includes('select ls.*, wp.user_id from learning_sessions ls')) {
    const twoHoursAgo = params![0];
    const missed = tables.learning_sessions.filter(
      (s) => s.status === 'planned' && new Date(s.scheduled_at) <= twoHoursAgo
    );
    return {
      rows: missed.map((s) => {
        const plan = tables.weekly_plans.find((p) => p.id === s.plan_id);
        return { ...s, user_id: plan?.user_id };
      }),
    };
  }

  if (queryText.includes('update learning_sessions set status =')) {
    const id = params![0];
    const status = params![1];
    const notes = params![2];
    const completedAt = params![3];
    const source = params![4];
    const session = tables.learning_sessions.find((s) => s.id === id);
    if (session) {
      session.status = status;
      if (notes) session.notes = notes;
      if (completedAt) session.completed_at = completedAt;
      if (source) session.completion_source = source;
    }
    return { rows: [] };
  }

  if (queryText.includes('insert into a2a_tasks')) {
    const task = {
      id: params![0],
      user_id: params![1],
      skill_id: params![2],
      external_caller: params![3],
      state: params![4],
      input_message: JSON.parse(params![5] || '{}'),
      artifact: params![6] ? JSON.parse(params![6]) : null,
    };
    tables.a2a_tasks.push(task);
    return { rows: [task] };
  }

  if (queryText.includes('update a2a_tasks set state =')) {
    const id = params![0];
    const state = params![1];
    const artifact = params![2] ? JSON.parse(params![2]) : null;
    const task = tables.a2a_tasks.find((t) => t.id === id);
    if (task) {
      task.state = state;
      if (artifact) task.artifact = artifact;
    }
    return { rows: [] };
  }

  if (queryText.includes('insert into reflection_entries')) {
    const entry = {
      id: params![0],
      user_id: params![1],
      trigger_type: params![2],
      prompt_text: params![3],
      response_text: params![4],
      skipped: params![5],
      created_at: new Date(),
    };
    tables.reflection_entries.push(entry);
    return { rows: [entry] };
  }

  if (queryText.includes('select * from reflection_entries where user_id =')) {
    const entries = tables.reflection_entries.filter((r) => r.user_id === params![0]);
    entries.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    return { rows: entries };
  }

  if (queryText.includes('delete from')) {
    const userId = params![0];
    tables.users = tables.users.filter((u) => u.id !== userId);
    tables.learner_profiles = tables.learner_profiles.filter((p) => p.user_id !== userId);
    const userPlans = tables.weekly_plans.filter((p) => p.user_id === userId);
    const planIds = userPlans.map((p) => p.id);
    tables.weekly_plans = tables.weekly_plans.filter((p) => p.user_id !== userId);
    tables.learning_sessions = tables.learning_sessions.filter((s) => !planIds.includes(s.plan_id));
    tables.reflection_entries = tables.reflection_entries.filter((r) => r.user_id !== userId);
    return { rows: [] };
  }

  return { rows: [] };
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/mock_bloom',
});

const isTest = process.env.NODE_ENV === 'test' || !process.env.DATABASE_URL;

export const db = {
  query: (text: string, params?: any[]) => {
    if (isTest) {
      return mockQuery(text, params);
    }
    return pool.query(text, params);
  },
  getClient: () => pool.connect(),
  close: () => pool.end(),
};
