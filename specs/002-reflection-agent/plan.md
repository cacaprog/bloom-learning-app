# Implementation Plan: Reflection Agent with the Reflection Flow

**Branch**: `002-reflection-agent` | **Date**: 2026-06-30 | **Spec**: [spec.md](file:///home/cairo/code/bloom-learning/my-project/specs/002-reflection-agent/spec.md)

**Input**: Feature specification from `/specs/002-reflection-agent/spec.md`

---

## Summary
Implement a stateless `ReflectionAgent` prompt variant that generates brief, contextual prompts for user reflection after key triggers (session completion, week end, recovery). Integrate this into the Coordinator state-machine and persist reflections to the PostgreSQL database.

---

## Technical Context

**Language/Version**: Node.js/TypeScript v20

**Primary Dependencies**: Express, Zod, pg, tsx, jest, ts-jest, supertest

**Storage**: PostgreSQL (`reflections` table)

**Testing**: Jest + Supertest (unit & integration tests)

**Target Platform**: Linux server, web application

**Project Type**: web-service

**Performance Goals**: p50 end-to-end response latency < 2s; reflection timeout budget < 3s

**Constraints**: Max 150-word response limits, strict global safety filter scans

**Scale/Scope**: ~10k concurrent users, ~100k daily logs

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Verification / Guard | Status |
|-----------|----------------------|--------|
| **I. Agency First** | Reflections are completely optional; the user must be able to skip prompts without penalty. | Pass ✅ |
| **II. Structured Conversation** | Reflection prompts use structured triggers and bounded dialogue stages. | Pass ✅ |
| **V. Specialized Agents** | `ReflectionAgent` is a stateless prompt variant executing within the Coordinator process. | Pass ✅ |
| **VI. Coordinator as Gatekeeper** | All reflection inputs/outputs route through the Coordinator and global safety filters. | Pass ✅ |

---

## Project Structure

### Documentation (this feature)

```text
specs/002-reflection-agent/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── contracts/           # Phase 1 output
    └── reflection-api.json
```

### Source Code

```text
backend/
├── src/
│   ├── models/
│   │   └── reflection.ts
│   ├── specialists/
│   │   └── reflection.agent.ts
│   └── api/
│       └── reflection.ts
└── tests/
    └── integration/
        └── reflection.test.ts
```

**Structure Decision**: Web Application (Option 2) matching the established backend/frontend architecture.

---

## Complexity Tracking

No violations of project constitution. No complexity adjustments required.
