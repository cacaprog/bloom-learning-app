# Tasks: Reflection Agent with the Reflection Flow

**Input**: Design documents from `/specs/002-reflection-agent/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Integration tests are requested for validating state machine flow, trigger context, and db logging.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Verify active feature directory is `specs/002-reflection-agent`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [X] T002 Create SQL migration script for reflection entries table at `backend/src/db/migrations/02_reflections.sql`
- [X] T003 Run database migration locally to provision the database schema
- [X] T004 Create database model schema definitions for ReflectionEntry in `backend/src/models/reflection.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Post-Session & Recovery Reflection (Priority: P1) 🎯 MVP

**Goal**: Present reflection prompt after learning sessions or recovery flows complete, saving response or skip state.

**Independent Test**: Complete post-session event, verify prompt is generated, submit user text or click skip, and assert record creation.

### Tests for User Story 1
- [X] T005 [P] [US1] Create unit tests verifying prompt generation based on trigger types in `backend/tests/integration/reflection.test.ts`
- [X] T006 [US1] Create integration tests validating chat state transitions from REFLECTION to ACTIVE_WEEK in `backend/tests/integration/reflection.test.ts`

### Implementation for User Story 1
- [X] T007 [P] [US1] Create stateless prompt template and execution wrapper for the Reflection Specialist in `backend/src/specialists/reflection.agent.ts`
- [X] T008 [US1] Wire Reflection Specialist delegation and skipping triggers into Coordinator state-machine in `backend/src/coordinator/coordinator.service.ts`
- [X] T009 [US1] Implement reflection logging and fetch API routes in `backend/src/api/reflection.ts`
- [X] T010 [P] [US1] Create reflection prompt card UI with text input and skip controls in `frontend/src/components/ReflectionPrompt.tsx`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently.

---

## Phase 4: User Story 2 - End-of-Week Review Integration (Priority: P1)

**Goal**: Force a weekly review reflection when starting the weekly planner.

**Independent Test**: Request a weekly plan, verify user is prompted with reflection first, then proceed to option choice after submission.

### Tests for User Story 2
- [X] T011 [US2] Add integration test for weekly review reflection prompt sequence and state checks in `backend/tests/integration/reflection.test.ts`

### Implementation for User Story 2
- [X] T012 [US2] Wire weekly review trigger state transitions in `backend/src/coordinator/coordinator.service.ts`
- [X] T013 [P] [US2] Add end-of-week reflection card wrapper to the weekly planner layout in `frontend/src/components/WeeklyPlanner.tsx`

**Checkpoint**: User Stories 1 AND 2 are fully integrated and functional.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Performance checks, cleanup, and documentation updates.

- [X] T014 Run quickstart.md validation script and document commands in `runbook.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: Depend on Foundational completion

### Parallel Opportunities
- Foundational model `T004` and migration `T002` can be created in parallel.
- On Story 1, specialist template `T007` and UI card `T010` can be created in parallel.

---

## Implementation Strategy
* **MVP First**: Complete Phase 1 and 2, then complete User Story 1 (Post-Session) to deliver immediate user value. Validate it, then proceed to User Story 2 (Weekly Review).
