# Implementation Plan: External Prompt Storage

**Branch**: `003-external-prompt-storage` | **Date**: 2026-06-30 | **Spec**: [spec.md](file:///home/cairo/code/bloom-learning/my-project/specs/003-external-prompt-storage/spec.md)

**Input**: Feature specification from `/specs/003-external-prompt-storage/spec.md`

---

## Summary
Deconstruct hardcoded string prompts into markdown instruction files under `backend/src/prompts/`. Implement a cached prompt reader service that reloads files on update to ensure zero-latency lookups during runtime.

---

## Technical Context

**Language/Version**: Node.js/TypeScript v20

**Primary Dependencies**: standard Node `fs`, `path`

**Storage**: File system storage (`backend/src/prompts/` directory)

**Testing**: Jest + ts-jest

**Target Platform**: Linux server, web application

**Project Type**: web-service

**Performance Goals**: File loading from cache < 0.1ms; hot-reload propagation < 500ms

**Constraints**: Fall back to default string configurations on reading errors

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Verification / Guard | Status |
|-----------|----------------------|--------|
| **V. Specialized Agents** | Prompt Markdown files govern prompt variants but do not bypass Coordinator state controls. | Pass ✅ |
| **VI. Coordinator as Gatekeeper** | All loaded prompts are processed through the central Coordinator and the global safety filter. | Pass ✅ |

---

## Project Structure

### Documentation (this feature)

```text
specs/003-external-prompt-storage/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── contracts/           # Phase 1 output
    └── prompts-structure.json
```

### Source Code

```text
backend/
├── src/
│   ├── prompts/
│   │   ├── onboarding.md
│   │   ├── planning.md
│   │   ├── recovery.md
│   │   └── reflection.md
│   └── services/
│       └── prompt.service.ts
└── tests/
    └── unit/
        └── prompt.test.ts
```

**Structure Decision**: Web Application (Option 2) matching the established backend structure.

---

## Complexity Tracking
No constitution rules violated.
