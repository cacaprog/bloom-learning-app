# Quickstart Validation Guide: Bloom Coaching Core

This guide outlines runnable scenarios to validate the implementation of the Bloom Coaching Core feature.

## Prerequisites

1. **Node.js**: v20 or higher.
2. **Database**: PostgreSQL instance running.
3. **Environment Variables**:
   ```bash
   DATABASE_URL="postgresql://localhost:5432/bloom_coaching"
   LLM_API_KEY="your_api_key_here"
   A2A_SIGNING_KEY="signature_key"
   ```

## Setup Scenarios

### Step 1: Install Dependencies
From the `backend/` directory, run:
```bash
npm install
```

### Step 2: Database Migration Setup
Initialize the database schemas defined in [data-model.md](file:///home/cairo/code/bloom-learning/my-project/specs/001-bloom-coaching-core/data-model.md):
```bash
npm run db:migrate
```

### Step 3: Run the Server
Start the development server (runs the Coordinator and REST/RPC endpoints):
```bash
npm run dev
```

---

## Validation Scenarios

### Scenario 1: Onboarding Conversation (US1)
Validate the state-machine progression and LearnerProfile storage.
1. **Action**: Issue a POST request to `/api/chat` with a welcome payload.
   ```bash
   curl -X POST http://localhost:3000/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello, let'\''s start"}'
   ```
2. **Expected Outcome**:
   * Returns state `S1_WELCOME`.
   * Response contains a warm introduction (under 150 words).
   * Database logs a `CoachMessage` row with `safety_check_passed: true`.

### Scenario 2: Recovery Grace Period Timer (US3)
Validate recovery trigger logic after a missed session.
1. **Action**: Insert a test `LearningSession` scheduled 2.5 hours in the past with status `planned`. Execute the cron evaluation command:
   ```bash
   npm run cron:check-missed
   ```
2. **Expected Outcome**:
   * Session status transitions to `missed`.
   * A recovery message is queued for the user.
   * Verify that no recovery is triggered for sessions missed less than 2 hours ago.

### Scenario 3: A2A Task Execution (US4)
Validate external task delegation.
1. **Action**: Dispatch a JSON-RPC request to the A2A RPC endpoint using a valid mock token, matching [a2a-api.json](file:///home/cairo/code/bloom-learning/my-project/specs/001-bloom-coaching-core/contracts/a2a-api.json).
   ```bash
   curl -X POST http://localhost:3000/api/a2a \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer mock-token" \
     -d '{"jsonrpc": "2.0", "method": "tasks/send", "params": {"id": "f5b820a0-0b61-4a1d-84f9-ea9a0a1a0a20", "message": {"role": "user", "parts": [{"type": "data", "data": {"skill_id": "plan_week", "user_id": "a2a-user-uuid", "context": "Prefer evenings"}}]}}}'
   ```
2. **Expected Outcome**:
   * HTTP 200 return containing JSON-RPC structure with task state `completed` or `working`.
   * Final output contains `weekly_plan` artifact data.
