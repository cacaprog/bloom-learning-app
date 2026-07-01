# Tasks: Bloom Coaching Core

**Input**: Design documents from `specs/001-bloom-coaching-core/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and workspaces structure

- [X] T001 Initialize Node.js backend workspace in `backend/package.json`
- [X] T002 Initialize TypeScript React workspace in `frontend/package.json`
- [X] T003 [P] Configure ESLint and Prettier for backend and frontend in `.eslintrc.js`
- [X] T004 [P] Setup Jest environment and ts-jest in `backend/jest.config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Configure PostgreSQL database connection pool in `backend/src/services/db.service.ts`
- [X] T006 Create database migration tool and initial table schemas (Users, LearnerProfile, WeeklyPlan, LearningSession, CoachMessage, AgentDelegation, A2ATask) in `backend/src/db/migrations/01_init.sql`
- [X] T007 [P] Implement global Express server setup and routing structure in `backend/src/index.ts`
- [X] T008 [P] Implement validation and error handling middlewares in `backend/src/api/middleware.ts`
- [X] T009 Implement Central Coordinator state routing skeleton in `backend/src/coordinator/coordinator.service.ts`
- [X] T010 Implement global safety filter regex patterns and scanning functions in `backend/src/coordinator/safety.filter.ts`
- [X] T011 Create private Coordinator ↔ Specialist communication JSON envelope validation schemas in `backend/src/services/envelope.service.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Structured Onboarding Interview (Priority: P1) 🎯 MVP

**Goal**: Build a structured learner profile through a S1-S6 dialog flow with the Onboarding Specialist.

**Independent Test**: Execute the onboarding chat API from state S1 to S6, verifying the generated `LearnerProfile` object contains 100% of required fields.

- [X] T012 [P] [US1] Create logical database model schema definitions for User and LearnerProfile in `backend/src/models/user.ts` and `backend/src/models/profile.ts`
- [X] T013 [P] [US1] Create the stateless prompt template and execution wrapper for the Onboarding Specialist in `backend/src/specialists/onboarding.agent.ts`
- [X] T014 [US1] Wire the Onboarding Specialist delegation into the Coordinator routing state-machine in `backend/src/coordinator/coordinator.service.ts`
- [X] T015 [US1] Implement user chat API route and controller to process messages for onboarding users in `backend/src/api/chat.ts`
- [X] T016 [P] [US1] Implement responsive layout, welcome screen, and chat bubble components for the onboarding interface in `frontend/src/components/OnboardingChat.tsx`
- [X] T017 [US1] Implement onboarding summary review and profile confirmation screen in `frontend/src/components/ProfileSummary.tsx`
- [X] T018 [US1] Add integration test for state-machine transitions S1-S6 and profile persistence in `backend/tests/integration/onboarding.test.ts`

**Checkpoint**: At this point, User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Weekly Planning & Calendar Sync (Priority: P1)

**Goal**: Co-create weekly plans with choices presented by the Planning Agent, and sync to user's digital calendar via MCP server.

**Independent Test**: Complete the planning chat loop, verify options are selected, confirm the plan, and verify calendar events are created via MCP calendar tools.

- [X] T019 [P] [US2] Create logical database model schema definitions for WeeklyPlan and LearningSession in `backend/src/models/plan.ts` and `backend/src/models/session.ts`
- [X] T020 [P] [US2] Create the stateless prompt template and execution wrapper for the Planning Specialist in `backend/src/specialists/planning.agent.ts`
- [X] T021 [US2] Implement the calendar client service using Model Context Protocol SDK to invoke tools in `backend/src/services/calendar.service.ts`
- [X] T022 [US2] Wire the Planning Specialist delegation and MCP calendar sync actions into the Coordinator state-machine in `backend/src/coordinator/coordinator.service.ts`
- [X] T023 [US2] Implement plan creation and modification API endpoints in `backend/src/api/planning.ts`
- [X] T024 [P] [US2] Create interactive weekly planner, slot choice buttons, and confirmation UI components in `frontend/src/components/WeeklyPlanner.tsx`
- [X] T025 [US2] Add integration test for planning flow iterations, budget enforcement, and calendar event mock assertions in `backend/tests/integration/planning.test.ts`

**Checkpoint**: At this point, User Stories 1 and 2 work independently.

---

## Phase 5: User Story 3 - Missed Session Recovery Coaching (Priority: P2)

**Goal**: Automatically initiate nonjudgmental recovery flow 2 hours after a missed session and guide the user to reschedule.

**Independent Test**: Trigger the missed session check cron, verify the recovery stage transitions, and check calendar rescheduling sync.

- [X] T026 [P] [US3] Create the stateless prompt template and execution wrapper for the Recovery Specialist in `backend/src/specialists/recovery.agent.ts`
- [X] T027 [US3] Implement session checking cron job logic to flag missed sessions and trigger recovery events in `backend/src/services/cron.service.ts`
- [X] T028 [US3] Wire the Recovery Specialist delegation and sequential planning fallback into the Coordinator routing state-machine in `backend/src/coordinator/coordinator.service.ts`
- [X] T029 [P] [US3] Implement the in-app chat-based recovery modal and rescheduling prompt UI elements in `frontend/src/components/RecoveryModal.tsx`
- [X] T030 [US3] Add integration test for the 2-hour grace period verification, recovery coaching state trigger, and rescheduling updates in `backend/tests/integration/recovery.test.ts`

**Checkpoint**: User Stories 1, 2, and 3 work independently.

---

## Phase 6: User Story 4 - Agent-to-Agent (A2A) External Interface (Priority: P2)

**Goal**: Expose signed Agent Card and JSON-RPC endpoints to delegate task execution via A2A protocols.

**Independent Test**: Authenticate JSON-RPC calls, check scopes, execute tasks through the Coordinator, and verify output artifact format.

- [X] T031 [P] [US4] Create database model schema definitions for tracking A2ATask in `backend/src/models/a2a.ts`
- [X] T032 [US4] Implement A2A OAuth token scope validation and header verification middleware in `backend/src/api/auth.ts`
- [X] T033 [US4] Implement A2A JSON-RPC tasks endpoint and Coordinator adapter in `backend/src/api/a2a.ts`
- [X] T034 [US4] Expose signed Agent Card metadata endpoints at `backend/src/api/well-known.ts`
- [X] T035 [US4] Add integration test for JSON-RPC task pipeline, validating scope rejection, task completion, and artifact format in `backend/tests/contract/a2a.test.ts`

**Checkpoint**: All user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Performance checks, final integrations, and deployment configurations

- [X] T036 Add final user feedback surveys and styling adjustments in `frontend/src/index.css`
- [X] T037 Perform final end-to-end local latency validation checks as documented in `quickstart.md`
- [X] T038 [P] Write configuration files for Railway and Vercel environments in `railway.json` and `vercel.json`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User Story 1 (P1) is the core MVP and has no dependencies on other stories.
  - User Story 2 (P1) can start in parallel with US1 once Foundation is complete.
  - User Story 3 (P2) depends on US2 components for planning adjustments.
  - User Story 4 (P2) depends on US2 and US3 core planning and recovery workflows.

---

## Parallel Execution Examples

### User Story 1 (Onboarding)
```bash
# Implement the onboarding prompt template and database models concurrently:
Task: "Create logical database model schema definitions for User and LearnerProfile in backend/src/models/user.ts and backend/src/models/profile.ts"
Task: "Create the stateless prompt template and execution wrapper for the Onboarding Specialist in backend/src/specialists/onboarding.agent.ts"
```

### User Story 2 (Weekly Planning)
```bash
# Implement Planning agent prompts and models concurrently:
Task: "Create logical database model schema definitions for WeeklyPlan and LearningSession in backend/src/models/plan.ts and backend/src/models/session.ts"
Task: "Create the stateless prompt template and execution wrapper for the Planning Specialist in backend/src/specialists/planning.agent.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Onboarding)
4. Complete Phase 4: User Story 2 (Weekly Planning)
5. **STOP and VALIDATE**: Verify end-to-end planning with calendar sync.
6. Progress sequentially to US3 (Recovery) and US4 (A2A Interface) after validation.
