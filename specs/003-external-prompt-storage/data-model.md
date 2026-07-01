# Data Model: Prompt File Structure & Metadata

This document outlines the file-based data structures and reload cycles.

---

## 1. Cache Schema: `PromptCache`

The in-memory data store is structured as follows:

```typescript
interface PromptCache {
  onboarding: string;
  planning: string;
  recovery: string;
  reflection: string;
}
```

---

## 2. File Directory Metadata

```text
backend/src/prompts/
├── onboarding.md
├── planning.md
├── recovery.md
└── reflection.md
```

---

## 3. Fallback Rules
If a file read fails, the system defaults to:
* **`onboarding`**: "Hello! I am your Bloom self-learning coach..."
* **`planning`**: "Based on your budget, let's draft options..."
* **`recovery`**: "I noticed you missed your session. No judgment..."
* **`reflection`**: "What went well in this session?"
