# Data Model Specification: Bloom Coaching Core

This document outlines the logical schema and state transitions for the core entities of the Bloom Coaching application.

## Entity Schema

### 1. User
Represents a registered learner account.
* **Fields**:
  * `id`: `UUID` (Primary Key)
  * `email`: `VARCHAR(255)` (Unique, Indexed)
  * `created_at`: `TIMESTAMP WITH TIME ZONE`
  * `timezone`: `VARCHAR(50)`
* **Relationships**:
  * Has One `LearnerProfile`
  * Has Many `WeeklyPlan`
  * Has Many `CoachMessage`
  * Has Many `A2ATask`

### 2. LearnerProfile
Contains goals, motivations, barriers, resources, and confidence metrics captured during onboarding.
* **Fields**:
  * `id`: `UUID` (Primary Key)
  * `user_id`: `UUID` (Foreign Key -> User.id, Unique, Indexed)
  * `primary_goal`: `TEXT` (Mandatory, user's own words)
  * `goal_category`: `VARCHAR(50)` (Enum: `technical`, `professional`, `creative`, `language`, `other`)
  * `motivation_reasons`: `TEXT[]`
  * `past_attempts`: `JSONB` (Array of objects detailing what was tried, what helped, what hindered)
  * `barriers`: `JSONB` (Array of barrier type, description, and severity scale 1-10)
  * `weekly_time_budget_hours`: `INTEGER` (Mandatory)
  * `best_time`: `VARCHAR(20)` (Enum: `morning`, `midday`, `evening`, `variable`)
  * `preferred_formats`: `VARCHAR(50)[]`
  * `confidence_score`: `INTEGER` (Scale 1-10)
  * `readiness_stage`: `VARCHAR(30)` (Enum: `contemplation`, `preparation`, `action`, `maintenance`)
  * `success_definition`: `TEXT`
  * `created_at`: `TIMESTAMP WITH TIME ZONE`
  * `updated_at`: `TIMESTAMP WITH TIME ZONE`
* **Validation Rules**:
  * `weekly_time_budget_hours` MUST be greater than 0 and less than 168.
  * `confidence_score` MUST be between 1 and 10.

### 3. WeeklyPlan
Defines the structure of study plans for a specific week.
* **Fields**:
  * `id`: `UUID` (Primary Key)
  * `user_id`: `UUID` (Foreign Key -> User.id, Indexed)
  * `week_start`: `DATE` (Monday of the plan week, Indexed)
  * `weekly_goal`: `TEXT`
  * `flexibility_note`: `TEXT`
  * `created_at`: `TIMESTAMP WITH TIME ZONE`
* **Relationships**:
  * Has Many `LearningSession`

### 4. LearningSession
An individual study block linked to a WeeklyPlan, synchronized with the user's digital calendar.
* **Fields**:
  * `id`: `UUID` (Primary Key)
  * `plan_id`: `UUID` (Foreign Key -> WeeklyPlan.id, Indexed)
  * `scheduled_at`: `TIMESTAMP WITH TIME ZONE`
  * `duration_minutes`: `INTEGER`
  * `topic`: `VARCHAR(255)`
  * `format`: `VARCHAR(50)` (Enum: `reading`, `practice`, `project`, `review`)
  * `effort_level`: `VARCHAR(20)` (Enum: `light`, `moderate`, `deep`)
  * `status`: `VARCHAR(20)` (Enum: `planned`, `completed`, `missed`, `rescheduled`)
  * `calendar_event_id`: `VARCHAR(255)` (Nullable, external ID from Google/Outlook Calendar)
  * `completed_at`: `TIMESTAMP WITH TIME ZONE` (Nullable)
  * `completion_source`: `VARCHAR(20)` (Enum: `app`, `mcp`, `a2a`, `manual`)
  * `notes`: `TEXT`
* **Validation Rules**:
  * `duration_minutes` MUST be > 0.
  * `status` transitions must follow the session state machine.

### 5. CoachMessage
A log of dialog messages exchanged between the learner and the Coordinator.
* **Fields**:
  * `id`: `UUID` (Primary Key)
  * `user_id`: `UUID` (Foreign Key -> User.id, Indexed)
  * `session_id`: `UUID` (Nullable, references a recovery flow or planning session)
  * `role`: `VARCHAR(20)` (Enum: `user`, `assistant`)
  * `agent_id`: `VARCHAR(30)` (Nullable, e.g., `coordinator`, `onboarding`, `planning`, `recovery`, `reflection`)
  * `mode`: `VARCHAR(20)` (Enum: `onboarding`, `planning`, `recovery`, `reflection`, `generic`)
  * `state`: `VARCHAR(50)` (Active dialog state, e.g., `S2_GOAL_DISCOVERY`, `RECOVERY_EXPLORE`)
  * `strategy`: `VARCHAR(50)` (Nullable, coaching strategy used)
  * `content`: `TEXT` (Word limit <= 150)
  * `safety_check_passed`: `BOOLEAN`
  * `created_at`: `TIMESTAMP WITH TIME ZONE`

### 6. AgentDelegation
Logs internal, stateless payload execution from the Coordinator to the Specialist agents.
* **Fields**:
  * `id`: `UUID` (Primary Key)
  * `coordinator_message_id`: `UUID` (Foreign Key -> CoachMessage.id)
  * `from_agent`: `VARCHAR(30)`
  * `to_agent`: `VARCHAR(30)`
  * `task`: `TEXT`
  * `payload`: `JSONB`
  * `response`: `JSONB` (Nullable)
  * `status`: `VARCHAR(20)` (Enum: `pending`, `completed`, `failed`, `timeout`)
  * `started_at`: `TIMESTAMP WITH TIME ZONE`
  * `completed_at`: `TIMESTAMP WITH TIME ZONE` (Nullable)

### 7. A2ATask
Tracks external agent-to-agent delegation lifecycle requests.
* **Fields**:
  * `id`: `UUID` (Primary Key, matches incoming A2A task ID)
  * `user_id`: `UUID` (Foreign Key -> User.id, Indexed)
  * `skill_id`: `VARCHAR(50)` (Enum: `plan_week`, `recovery_coaching`, `reflect_session`)
  * `external_caller`: `VARCHAR(255)` (Signed provider url/id)
  * `state`: `VARCHAR(20)` (Enum: `submitted`, `working`, `input-required`, `completed`, `failed`)
  * `input_message`: `JSONB`
  * `artifact`: `JSONB` (Nullable, final payload result)
  * `created_at`: `TIMESTAMP WITH TIME ZONE`
  * `updated_at`: `TIMESTAMP WITH TIME ZONE`

---

## State Machines

### Session State Transitions

```
   [planned] ───────────────────► [completed]
       │                              ▲
       │(2h Grace Period / Missed)    │(Reschedule / Adjust)
       ▼                              │
    [missed] ───────────────────► [rescheduled]
```

* **Rules**:
  * A session enters `missed` status 2 hours after the scheduled time if no completion is logged.
  * Shifting status from `missed` to `completed` or `rescheduled` requires active user participation via recovery coaching.

### User System State Transitions

```
[NEW USER]
    │
    ▼
[ONBOARDING] ──(profile confirmed)──► [PLANNING]
    │                                        │
    │(incomplete)                            │(plan confirmed)
    ▼                                        ▼
[INACTIVE]                              [ACTIVE WEEK]
```
