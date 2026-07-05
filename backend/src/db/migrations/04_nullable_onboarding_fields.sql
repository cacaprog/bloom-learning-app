-- Allow weekly_time_budget_hours and confidence_score to be genuinely unknown
-- instead of forcing a fabricated value when onboarding never captures them.
ALTER TABLE learner_profiles ALTER COLUMN weekly_time_budget_hours DROP NOT NULL;
ALTER TABLE learner_profiles ALTER COLUMN confidence_score DROP NOT NULL;
