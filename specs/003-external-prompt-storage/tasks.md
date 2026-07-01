# Tasks: External Prompt Storage

**Input**: Design documents from `/specs/003-external-prompt-storage/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Unit and integration tests are requested to verify hot-reload cycles.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Verify active feature directory is `specs/003-external-prompt-storage`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [X] T002 Create prompts directory at `backend/src/prompts/`
- [X] T003 Create initial markdown prompt files: `onboarding.md`, `planning.md`, `recovery.md`, and `reflection.md` under `backend/src/prompts/`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Decoupled Prompt Editing (Priority: P1) 🎯 MVP

**Goal**: Load prompts dynamically from disk, cache in memory, watch for changes, and fall back to default strings on read error.

**Independent Test**: Modify the markdown file, trigger the coach, and verify that the output reflects the new markdown text instantly.

### Tests for User Story 1
- [X] T004 [P] [US1] Create unit tests validating file loading, fallback logic, and cache operations in `backend/tests/unit/prompt.test.ts`
- [X] T005 [US1] Create integration tests asserting hot-reloading response changes under FS watch triggers in `backend/tests/integration/prompt-reload.test.ts`

### Implementation for User Story 1
- [X] T006 [P] [US1] Implement `PromptService` reading files into memory cache and configuring `fs.watch` triggers in `backend/src/services/prompt.service.ts`
- [X] T007 [US1] Refactor `onboarding.agent.ts`, `planning.agent.ts`, `recovery.agent.ts`, and `reflection.agent.ts` to resolve system instruction strings via `promptService`

**Checkpoint**: At this point, User Story 1 is fully functional and testable independently.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Performance checks, cleanup, and documentation updates.

- [X] T008 Update verification guides and hot-reloading curl examples in `runbook.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup completion
- **User Story 1 (Phase 3)**: Depends on Foundational completion

### Parallel Opportunities
- Initial markdown prompts `T003` can be written in parallel with directory setup verification.
- Unit tests `T004` and PromptService implementation `T006` can be coded in parallel.
