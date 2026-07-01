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

Create a `.env` file in the `backend/` directory if you plan to connect to a real PostgreSQL instance:

```env
PORT=3000
DATABASE_URL="postgresql://username:password@localhost:5432/bloom_coaching"
NODE_ENV="development"
```
*Note: If `DATABASE_URL` is not provided, the database service automatically operates using an in-memory SQL mock, which is excellent for quick developer validation and testing.*

---

## 4. Running Database Migrations

Apply the table schemas defined in [01_init.sql](file:///home/cairo/code/bloom-learning/my-project/backend/src/db/migrations/01_init.sql) to your database:

```bash
cd backend
npm run db:migrate
```

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
