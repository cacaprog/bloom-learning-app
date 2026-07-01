# Quickstart & Verification Guide: Reflection Agent

This guide outlines runnable scenarios to verify the correctness of the Reflection Agent flow.

---

## 1. Prerequisites
Ensure the backend server is running in dev mode:
```bash
cd backend
npm run dev
```

---

## 2. Validation Scenarios

### Scenario A: Trigger Post-Session Reflection Prompt
Log a learning session completion and verify the Reflection prompt is returned:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "mock-user-id",
    "message": "I finished my learning session!",
    "state": "REFLECTION"
  }'
```

**Expected Response**:
```json
{
  "response": "What went well in this session?",
  "state": "REFLECTION"
}
```

### Scenario B: Skip a Reflection Prompt
Submit a skip request and verify the user transitions back to `ACTIVE_WEEK`:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "mock-user-id",
    "message": "skip",
    "state": "REFLECTION"
  }'
```

**Expected Response**:
```json
{
  "response": "We're back on track! Let me know if you need to adjust anything else.",
  "state": "ACTIVE_WEEK"
}
```
