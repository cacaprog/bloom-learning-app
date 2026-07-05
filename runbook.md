# Bloom Coaching Core Runbook

This runbook outlines all instructions needed to configure, run, test, and validate the Bloom Coaching Core application locally.

---

## 1. Prerequisites

Make sure you have the following software installed:
* **Node.js**: v20 or higher
* **npm**: v10 or higher
* **PostgreSQL** (Optional, falls back to in-memory SQLite-like mock if `DATABASE_URL` is omitted)

---

## 2. Installation & Workspace Setup

Bloom is organized into two primary subdirectories: `backend/` and `frontend/`.

### Step 1: Install Backend Dependencies
Navigate to the `backend` directory and install packages:
```bash
cd backend
npm install
```

### Step 2: Install Frontend Dependencies
Navigate to the `frontend` directory and install packages:
```bash
cd ../frontend
npm install
```

---

## 3. Configuration & Environment Variables

Create a `.env` file in the `backend/` directory if you plan to connect to a real PostgreSQL database or external services:

```env
PORT=3000
DATABASE_URL="postgresql://username:password@localhost:5432/bloom_coaching"
NODE_ENV="development"

# (Optional) Model Context Protocol Calendar URL (SSE or HTTP JSON-RPC endpoint)
# e.g., MCP_CALENDAR_SERVER_URL="http://localhost:3001/"
```
*Note: If `DATABASE_URL` is not provided, the database service automatically operates using an in-memory SQL mock, which is excellent for quick developer validation and testing.*

---

## 4. Running Database Migrations

Apply the table schemas defined in [backend/src/db/migrations/](backend/src/db/migrations/) to your database. Migrations run in order (`01_init.sql` → `02_reflections.sql` → `03_memory.sql` → `04_nullable_onboarding_fields.sql`) and are safe to re-run:

```bash
cd backend
npm run db:migrate
```

*Note: [04_nullable_onboarding_fields.sql](backend/src/db/migrations/04_nullable_onboarding_fields.sql) makes `weekly_time_budget_hours` and `confidence_score` nullable on `learner_profiles`, so onboarding can store a genuinely unanswered field as unset instead of a fabricated default. If you're running against an existing database created before this migration, re-run `npm run db:migrate` to pick it up — the in-memory mock DB needs no migration step.*

---

## 5. Running the Application Locally

You can launch the backend coordinator API server and the frontend client concurrently.

### Run the Backend (Express Server)
From the `backend/` directory:
```bash
npm run dev
```
The server will run on `http://localhost:3000`.

### Run the Frontend (Vite Client)
From the `frontend/` directory:
```bash
npm run dev
```
The client will run on `http://localhost:5173`. Open this URL in your web browser.

---

## 6. Running Integration & Contract Tests

Jest is configured to run tests covering onboarding state transitions, weekly planning logic, missed session cron actions, and A2A external contracts.

From the `backend/` directory, run:
```bash
npm run test
```

---

## 7. Endpoint Verification cURLs

### Verification 1: Health Check
```bash
curl http://localhost:3000/health
```

### Verification 2: User Onboarding Dialog State S1
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, let'\''s begin Onboarding", "state": "ONBOARDING_S1"}'
```

### Verification 3: A2A Task Delegation (Weekly Planning)
Use the mock token to verify authorization checks:
```bash
curl -X POST http://localhost:3000/api/a2a \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mock-token" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tasks/send",
    "params": {
      "id": "e62f53ab-c103-4c6c-9f21-c8f3babce972",
      "message": {
        "role": "user",
        "parts": [
          {
            "type": "data",
            "data": {
              "skill_id": "plan_week",
              "user_id": "bfd0d6a2-6321-4f1e-930a-3e4b6dda5165"
            }
          }
        ]
      }
    }
  }'
```

### Verification 4: Trigger Reflection Prompt (Post-Session)
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"userId": "mock-user-id", "message": "I finished my learning session!", "state": "REFLECTION"}'
```

### Verification 5: Skip Reflection Prompt
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"userId": "mock-user-id", "message": "skip", "state": "REFLECTION"}'
```

### Verification 6: Weekly Plan Confirmation & Calendar Sync Confirmation
Confirming a plan now returns a `calendarSync` field alongside the usual response, naming how many sessions were actually added to the calendar:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"userId": "mock-user-id", "message": "/confirm-plan", "state": "PLANNING"}'
```
Expect a response containing:
```json
{
  "response": "...",
  "state": "ACTIVE_WEEK",
  "calendarSync": {
    "weeklyGoal": "...",
    "totalSessions": 3,
    "syncedCount": 3,
    "sessions": [ { "topic": "...", "scheduledAt": "...", "synced": true } ]
  }
}
```
If `syncedCount` is less than `totalSessions`, the response still states clearly which sessions did not sync — the confirmation never claims full success it didn't achieve.

### Verification 7: Onboarding Stage Gating (Incomplete Answer)
Sending a partial answer to a state that needs two pieces of information (weekly time budget *and* best focus time) no longer advances the conversation — the coach asks for the missing piece instead:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"userId": "mock-user-id", "message": "I can do 4 hours a week", "state": "ONBOARDING_S4"}'
```
Expect `"state": "ONBOARDING_S4"` (unchanged) in the response, with the reply asking specifically about focus time. Sending a follow-up message that supplies the missing piece advances to `"state": "ONBOARDING_S5"`. If neither piece is ever supplied, the state still advances after 3 turns in `ONBOARDING_S4` — but the missing field is stored as unset, not backfilled with a fabricated value.

---

## 8. Model API Configuration

You can configure the active AI model endpoint (Google Gemini or OpenAI) inside the backend environment variables.

### Environment Setup (`backend/.env`)
Add either of the following keys to your local configuration:

```env
# Enable Google Gemini (gemini-1.5-flash)
GEMINI_API_KEY="AIzaSy..."

# Enable OpenAI (gpt-4o-mini)
OPENAI_API_KEY="sk-..."
```

If neither key is configured or set, the system will automatically default to local mock fallback replies.

---

## 9. Model Context Protocol (MCP) Calendar Integration

Bloom supports syncing study session events directly to external calendars using the Model Context Protocol (MCP) or custom HTTP JSON-RPC calendar hosts.

### 9.1 Local Google Calendar MCP Server Configuration

The project bundles a local Google Calendar MCP server situated in the [mcp-google-calendar](mcp-google-calendar/) directory.

#### Step 1: Google Cloud Console Setup
To use Google Calendar syncing, you must register a project in the Google Cloud Console:
1. Enable the **Google Calendar API**.
2. Set up the **OAuth Consent Screen** (add test users and include scopes: `https://www.googleapis.com/auth/calendar` and `https://www.googleapis.com/auth/calendar.events`).
3. Create an **OAuth 2.0 Client ID** (Web application type) and add `http://localhost:3000/auth/callback` as an Authorized Redirect URI.

#### Step 2: Configure Environment Variables
Create or edit `mcp-google-calendar/.env` with your credentials:
```env
GOOGLE_CLIENT_ID="your_client_id"
GOOGLE_CLIENT_SECRET="your_client_secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/auth/callback"
```

#### Step 3: Authenticate and Generate Refresh Token
If you need to generate a new Google refresh token:
1. Start the auth flow:
   ```bash
   cd mcp-google-calendar
   npm run dev
   ```
2. Follow the URL output in your terminal to authenticate with your Google account.
3. Copy the authorization code from the redirected browser page.
4. Run the helper to save the token:
   ```bash
   npx ts-node src/auth-helper.ts "YOUR_AUTH_CODE"
   ```
   This writes the refresh token into `mcp-google-calendar/.env` and `mcp-google-calendar/.google_refresh_token`.

#### Step 4: Build the Server
Build the TypeScript source:
```bash
cd mcp-google-calendar
npm install
npm run build
```

#### Step 5: Registering the Server for local AI Agents
The server is integrated locally into the workspace's agent configuration at [.agents/mcp_config.json](.agents/mcp_config.json):
```json
{
  "mcpServers": {
    "google-calendar": {
      "command": "node",
      "args": [
        "dist/index.js"
      ],
      "cwd": "/home/cairo/code/bloom-learning/my-project/mcp-google-calendar"
    }
  }
}
```

---

### 9.2 Integrating the Server with the Backend
To configure the Express backend to make calls to this calendar server:

#### Step 1: Configure Calendar Server URL
Add the running calendar server address to `backend/.env`:
```env
MCP_CALENDAR_SERVER_URL="http://localhost:3001/"
```
*(If this variable is left empty or the server is unreachable, the system will gracefully fall back to mock local storage.)*

#### Step 2: Live Integration Flow
* During the **Weekly Planning** phase, once a learning plan is finalized and agreed upon (either via conversation or `/confirm-plan`), the backend triggers calendar sync tool calls.
* Events are dynamically created (using server-exposed tool names such as `create_event` or `create_calendar_event`).
* If a session is deleted or rescheduled, the corresponding remote events are deleted/updated using `delete_event`.

---

## 10. Recent Reliability Improvements

A structured post-launch review fixed four defects, all traced to the same root pattern — the system silently guessing or skipping past something instead of grounding its response in what was actually known. Each is now covered by automated tests and, where the defect was only reproducible against a real model, by repeated real-LLM verification (a mocked or single-run test cannot surface a probabilistic failure).

* **Schedule suggestion accuracy**: "today"/"tomorrow" and other relative day references are resolved against the learner's real timezone (`users.timezone`), not server time. A missing weekly time budget or best-focus-time preference is asked for instead of silently defaulted.
* **Calendar sync confirmation**: confirming a plan now returns a `calendarSync` field (see Verification 6) so the frontend can show the learner an honest sync result, including partial failures, instead of a silent transition.
* **Onboarding stage completeness**: each onboarding state (S1–S6) only advances once its required information is genuinely captured, or the existing 3-turn-per-state cap is reached (see Verification 7). Fields the learner never answered are stored as unset (`weekly_time_budget_hours`, `confidence_score` are nullable as of migration `04_nullable_onboarding_fields.sql`) rather than backfilled with a plausible-looking default.
* **Coordinator routing guard**: for every conversation state with one unambiguous required specialist, a deterministic check corrects the Coordinator's specialist choice if the LLM's routing call picks the wrong one — measured at roughly a 1-in-8 mismatch rate before this fix, 0-in-12 after, across repeated real-LLM trials.

