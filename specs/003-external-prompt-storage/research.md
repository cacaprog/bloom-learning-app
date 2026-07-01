# Research: Prompt Service Caching & Watcher

This document covers prompt reloading mechanisms and caching strategies to ensure zero-latency runtimes.

---

## 1. Hot Reload Options

### Option A: Read on every request (`fs.readFileSync`)
* *Pros*: Simple, always up-to-date.
* *Cons*: Synchronous I/O adds ~1-5ms per request. Under high request loads, this degrades server performance and violates latency requirements.

### Option B: In-memory cache with watcher (`fs.watch`)
* *Pros*: Zero latency during request resolution. File is read once and served from memory. Re-reads only when file modification occurs.
* *Cons*: Requires cleanup of watchers on application shutdown to prevent memory leaks.
* *Decision*: Use Option B (In-memory cache with `fs.watch`).

---

## 2. File Organization

Prompts will live in `backend/src/prompts/`:
* `onboarding.md` -> Loaded by Onboarding Specialist.
* `planning.md` -> Loaded by Planning Specialist.
* `recovery.md` -> Loaded by Recovery Specialist.
* `reflection.md` -> Loaded by Reflection Specialist.
