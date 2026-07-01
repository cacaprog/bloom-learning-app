# Specification: Reflection Agent with the Reflection Flow

## Overview
The Reflection Agent helps learners build self-awareness, consolidate learnings, and normalize partial progress. It provides brief, contextual, non-judgmental prompts to capture user insights after key events (session completion, week end, or recovery completion).

---

## User Stories

### User Story 1 - Post-Session Reflection (Priority: P1)
**Why this priority**: Immediate feedback loops reinforce learning habits.
**Acceptance Scenarios**:
1. **Given** a user completes a planned learning session, **When** the completion is registered, **Then** the Reflection Agent presents a brief reflection prompt ("What went well in this session?").
2. **Given** a reflection prompt is active, **When** the user answers or skips the reflection, **Then** the system saves the entry (or skip state) and returns the user to the active week interface.

### User Story 2 - End-of-Week Review (Priority: P1)
**Why this priority**: Helps users assess weekly rhythm and prepare for the next planning cycle.
**Acceptance Scenarios**:
1. **Given** the weekly planning period begins, **When** the user launches the coordinator, **Then** the Reflection Agent invites the user to perform a brief end-of-week reflection before co-creating the next plan.

---

## Requirements

### Functional Requirements
* **FR-001**: The system MUST implement a stateless `ReflectionAgent` to handle prompt generation and user response processing.
* **FR-002**: The Reflection Agent MUST support three prompt triggers: `session_completion`, `weekly_review`, and `recovery_completion`.
* **FR-003**: The Reflection Agent MUST allow users to skip any reflection prompt without penalty.
* **FR-004**: The system MUST store reflection answers in the database.

---

## Success Criteria

* **SC-001**: 100% of reflection prompts are presented to the user immediately after their corresponding trigger event.
* **SC-002**: Users can skip or dismiss a reflection prompt within a single action (click or command).
* **SC-003**: Reflection entries are persisted and shown to the user during the weekly review page.
