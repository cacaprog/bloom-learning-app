CREATE TABLE IF NOT EXISTS reflection_entries (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    trigger_type VARCHAR(32) NOT NULL,
    prompt_text TEXT NOT NULL,
    response_text TEXT,
    skipped BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reflection_user_trigger ON reflection_entries(user_id, trigger_type);
