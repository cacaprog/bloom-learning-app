# Feature Specification: Bloom Coaching Core

**Feature Branch**: `001-bloom-coaching-core`

**Created**: 2026-06-30

**Status**: Draft

**Input**: User description: "lets work on this project"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Structured Onboarding Interview (Priority: P1)

**Why this priority**: Core entry point that establishes the learner profile, goals, and barriers, which are essential for all subsequent coaching interactions.

**Independent Test**: The user completes the 5-8 minute onboarding conversation S1-S6. The system summarizes their profile, receives confirmation, and generates a valid `LearnerProfile` object without creating any plans yet.

**Acceptance Scenarios**:

1. **Given** a new user initiates onboarding, **When** they progress through states S1-S6 and confirm the summarized profile, **Then** a `LearnerProfile` is persisted with all mandatory fields captured.
2. **Given** a user is in state S2 (Goal Discovery), **When** they submit an out-of-flow query, **Then** the Coordinator intercepts the message, provides a bounded response, and redirects them to the onboarding goal discovery state.
3. **Given** a user is in onboarding, **When** the turn count for the current state reaches 3, **Then** the onboarding specialist gently transitions the user to the next state.

---

### User Story 2 - Weekly Planning & Calendar Sync (Priority: P1)

**Why this priority**: Connects the coaching logic to actionable user commitment via digital calendar integration (MCP).

**Independent Test**: An onboarding-complete user enters planning mode. A draft plan is generated and iterated on. Once confirmed, events are created on the user's Google/Outlook calendar.

**Acceptance Scenarios**:

1. **Given** the user is onboarding-complete, **When** planning is triggered, **Then** the system presents a weekly draft plan based on their profile and calendar availability, presenting choices rather than a single choice.
2. **Given** a draft plan is presented, **When** the user requests a modification, **Then** the Planning Agent adjusts the sessions while respecting the weekly time budget (within ±10% tolerance) and blocked slots.
3. **Given** a plan is confirmed, **When** the Planning Agent triggers the sync, **Then** the calendar events are created via the MCP server and marked as confirmed.

---

### User Story 3 - Missed Session Recovery Coaching (Priority: P2)

**Why this priority**: Essential feature for testing the recovery-over-streaks mindset hypothesis.

**Independent Test**: Simulate a missed study session. Verify the grace period delay, the trigger of the recovery agent, and the step-by-step guidance to reschedule or adjust.

**Acceptance Scenarios**:

1. **Given** a planned session has passed without completion, **When** the 2-hour grace period expires, **Then** the system triggers the Recovery Agent to initiate the recovery flow.
2. **Given** the recovery flow is active, **When** the coach communicates with the user, **Then** the message MUST NOT contain shame, guilt, or "should" language.
3. **Given** the recovery flow reaches the resolve stage, **When** the user reschedules the session, **Then** the Planning Agent is called sequentially to update the plan and sync the calendar event.

---

### User Story 4 - Agent-to-Agent (A2A) External Interface (Priority: P2)

**Why this priority**: Required for enabling discovery and delegation by external agents.

**Independent Test**: Send a JSON-RPC request to the A2A API requesting the `plan_week` skill. Verify oauth scopes, task state transition from `submitted` to `completed`, and the returned artifact structure.

**Acceptance Scenarios**:

1. **Given** an external agent issues a signed A2A request for the `plan_week` skill, **When** the caller is authenticated and holds the `coach.plan` scope, **Then** the task transitions through the Coordinator to the Planning Agent and returns the `weekly_plan` artifact.
2. **Given** an A2A task request, **When** the input is malformed or lacks valid authentication, **Then** the request is rejected at the system boundary before reaching the Coordinator.

---

### Edge Cases

- **Calendar Sync Failure**: If the `bloom-calendar-server` connection fails, the user must see a warning in the UI, and the local state MUST remain active, scheduling a background retry task.
- **Specialist Agent Timeout**: If a specialist agent fails to respond within its timeout window, the Coordinator MUST retry once, then fall back to a safe generic response.
- **Safety Filter Trigger**: If the global safety filter blocks a specialist response, the Coordinator MUST prevent the message from reaching the user and fall back to a safe generic coaching message.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST process all incoming user inputs through a single Coordinator that routes tasks and maintains state.
- **FR-002**: The Coordinator MUST NOT allow more than 1 specialist delegation per user turn.
- **FR-003**: The system MUST implement four stateless, specialized agents: Onboarding, Planning, Recovery, and Reflection.
- **FR-004**: The system MUST execute a global safety filter on all specialist outputs before delivering them to the user.
- **FR-005**: The system MUST support calendar integration via the MCP `bloom-calendar-server` using OAuth 2.0.
- **FR-006**: The system MUST publish a signed Agent Card at `/.well-known/agent.json` and support JSON-RPC 2.0 A2A tasks.
- **FR-007**: The system MUST wait exactly 2 hours after a missed session before triggering recovery coaching.
- **FR-008**: The system MUST enforce response length limits: maximum 150 words per coaching turn.

### Key Entities *(include if feature involves data)*

- **User**: The core user account containing identifier, email, and authentication credentials.
- **LearnerProfile**: The captured profile containing goals, barriers, resources, confidence, and readiness stage.
- **WeeklyPlan**: The schedule of sessions for a given week.
- **LearningSession**: An individual session entry containing topic, scheduled time, duration, status, and calendar event ID.
- **CoachMessage**: Record of conversational turns, associated agent strategies, and safety flags.
- **AgentDelegation**: Log of Coordinator-specialist payload exchanges, status, and latencies.
- **A2ATask**: Lifecycle record for tracking external A2A delegation requests.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 70% of users who initiate onboarding complete the flow within a median duration of 5-8 minutes.
- **SC-002**: Calendar synchronization succeeds for at least 95% of confirmed planning sessions.
- **SC-003**: End-to-end response generation latency achieves p50 < 4 seconds and p95 < 10 seconds.
- **SC-004**: The global safety filter successfully processes 100% of outbound coaching messages before user delivery.
- **SC-005**: The internal Coordinator routes incoming messages to the correct specialist with at least 90% accuracy.

---

## Assumptions

- Users have active, writable Google Calendar or Outlook accounts.
- Callers using the A2A endpoint adhere to the A2A v1.0 specification.
- A persistent relational data store is used for state and message logging.
