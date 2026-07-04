-- Learner memory facts extracted from coaching conversations
CREATE TABLE IF NOT EXISTS learner_memories (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  fact_type VARCHAR(20) NOT NULL CHECK(fact_type IN ('preference', 'barrier', 'progress', 'insight')),
  content TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  source_agent VARCHAR(30),
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_learner_memories_user ON learner_memories(user_id, created_at);

-- Periodic summaries that compress raw facts for long-term storage
CREATE TABLE IF NOT EXISTS memory_summaries (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  summary_text TEXT NOT NULL,
  fact_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_memory_summaries_user ON memory_summaries(user_id, period_end);
