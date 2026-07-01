# Quickstart & Verification Guide: External Prompt Storage

Verify dynamic prompt reloading.

---

## 1. Verify Hot-Reloading

1. Start the server in watch mode:
   ```bash
   cd backend
   npm run dev
   ```

2. Query the active reflection prompt:
   ```bash
   curl -X POST http://localhost:3000/api/chat \
     -H "Content-Type: application/json" \
     -d '{"userId": "mock-user-id", "message": "I finished my learning session!", "state": "REFLECTION"}'
   ```

3. Change the contents of `backend/src/prompts/reflection.md` to:
   ```markdown
   Hello, this is a custom hot-reloaded reflection prompt!
   ```

4. Repeat the request in Step 2. Verify that the response matches the new text.
