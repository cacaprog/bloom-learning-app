# Specification: External Prompt Storage

## Overview
Move coaching agent system instructions and prompt templates from hardcoded source code string literals into external Markdown files under a designated `prompts/` directory. This allows developers and designers to refine coaching guidelines and constraints without rebuilding the application code.

---

## User Stories

### User Story 1 - Decoupled Prompt Editing (Priority: P1)
**Why this priority**: Essential to let designers change prompts independently of code releases.
**Acceptance Scenarios**:
1. **Given** a prompt engineer edits a specialist system prompt in its corresponding `.md` file, **When** the coach executes a user message, **Then** the updated system instructions are dynamically loaded and reflected in the AI model parameters.
2. **Given** a prompt file is missing or unreadable, **When** the specialist is executed, **Then** the system falls back to default built-in safety prompt strings and logs a warning.

---

## Requirements

### Functional Requirements
* **FR-001**: The system MUST load specialist agent instructions from dedicated `.md` files in a `backend/src/prompts/` directory.
* **FR-002**: The system MUST cache the prompt contents in memory during development to ensure zero file read overhead during user turns, while providing a watch mechanism to reload on file modifications.
* **FR-003**: The system MUST validate that prompt templates are not empty and fall back to built-in fallback configurations on error.

---

## Success Criteria

* **SC-001**: System prompt modifications in markdown files are loaded and applied in under 1 second during development watch mode.
* **SC-002**: Runtime prompt lookup from the in-memory cache adds less than 1ms of execution latency.
