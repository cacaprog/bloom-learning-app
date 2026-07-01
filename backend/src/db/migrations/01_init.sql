-- Create Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  timezone VARCHAR(50) DEFAULT 'UTC'
);

-- Create LearnerProfile table
CREATE TABLE IF NOT EXISTS learner_profiles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  primary_goal TEXT NOT NULL,
  goal_category VARCHAR(50) NOT NULL,
  motivation_reasons TEXT[] NOT NULL,
  past_attempts JSONB NOT NULL DEFAULT '[]'::jsonb,
  barriers JSONB NOT NULL DEFAULT '[]'::jsonb,
  weekly_time_budget_hours INTEGER NOT NULL,
  best_time VARCHAR(20) NOT NULL,
  preferred_formats VARCHAR(50)[] NOT NULL,
  confidence_score INTEGER NOT NULL,
  readiness_stage VARCHAR(30) NOT NULL,
  success_definition TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create WeeklyPlan table
CREATE TABLE IF NOT EXISTS weekly_plans (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  weekly_goal TEXT NOT NULL,
  flexibility_note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_weekly_plans_user_date ON weekly_plans(user_id, week_start);

-- Create LearningSession table
CREATE TABLE IF NOT EXISTS learning_sessions (
  id UUID PRIMARY KEY,
  plan_id UUID REFERENCES weekly_plans(id) ON DELETE CASCADE NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL,
  topic VARCHAR(255) NOT NULL,
  format VARCHAR(50) NOT NULL,
  effort_level VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  calendar_event_id VARCHAR(255),
  completed_at TIMESTAMP WITH TIME ZONE,
  completion_source VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_learning_sessions_plan ON learning_sessions(plan_id);

-- Create CoachMessage table
CREATE TABLE IF NOT EXISTS coach_messages (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID,
  role VARCHAR(20) NOT NULL,
  agent_id VARCHAR(30),
  mode VARCHAR(20) NOT NULL,
  state VARCHAR(50) NOT NULL,
  strategy VARCHAR(50),
  content TEXT NOT NULL,
  safety_check_passed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coach_messages_user ON coach_messages(user_id);

-- Create AgentDelegation table
CREATE TABLE IF NOT EXISTS agent_delegations (
  id UUID PRIMARY KEY,
  coordinator_message_id UUID NOT NULL,
  from_agent VARCHAR(30) NOT NULL,
  to_agent VARCHAR(30) NOT NULL,
  task TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create A2ATask table
CREATE TABLE IF NOT EXISTS a2a_tasks (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  skill_id VARCHAR(50) NOT NULL,
  external_caller VARCHAR(255) NOT NULL,
  state VARCHAR(20) NOT NULL,
  input_message JSONB NOT NULL DEFAULT '{}'::jsonb,
  artifact JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_a2a_tasks_user ON a2a_tasks(user_id);
