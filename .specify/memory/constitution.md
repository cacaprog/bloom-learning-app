<!--
SYNC IMPACT REPORT:
- Version change: None -> 1.1.0 (Initial Ratification)
- Modified Principles:
  - [PRINCIPLE_1_NAME] -> I. Agency First
  - [PRINCIPLE_2_NAME] -> II. Structured Conversation
  - [PRINCIPLE_3_NAME] -> III. Plan + Coach Integration
  - [PRINCIPLE_4_NAME] -> IV. Recovery Over Streaks
  - [PRINCIPLE_5_NAME] -> V. Specialized Agents
  - Added: VI. Coordinator as Gatekeeper
  - Added: VII. System Boundary Protocol Separation
- Added Sections:
  - Technical Architecture & Constraints
  - Performance & Quality Gates
- Removed Sections: None
- Templates requiring updates:
  - .specify/templates/plan-template.md (✅ updated)
  - .specify/templates/spec-template.md (✅ updated)
  - .specify/templates/tasks-template.md (✅ updated)
- Follow-up TODOs: None
-->

# Bloom-for-Learning Constitution

## Core Principles

### I. Agency First
The learner owns all goals and decisions. The coach asks, reflects, and collaborates — never commands.
- The system MUST NOT impose learning plans or make modifications without explicit user agreement.
- All draft plans MUST be presented as starting points, and the coach MUST offer choices instead of a single option.
- The system MUST respect the user's weekly time budget within a ±10% tolerance.
- The system MUST NOT schedule learning sessions during the user's identified blocked calendar slots.
- The tone of all interactions MUST remain warm, curious, patient, and nonjudgmental.

### II. Structured Conversation
Every coaching interaction follows explicit, pre-defined dialog states to prevent free-form drift.
- The onboarding process MUST follow states S1-S6 sequentially and collect all required LearnerProfile fields.
- Out-of-flow user messages MUST be handled directly by the Coordinator with a single bounded response and redirect to the nearest structured flow.
- The recovery process MUST follow the initiate-explore-resolve-complete stage machine.
- The system MUST limit dialogue turns to predefined maximums (e.g., max 3 messages per onboarding state).

### III. Plan + Coach Integration
The calendar, progress tracking, and coaching engine must act in concert. The coach activates only when needed for planning, recovery, or reflection.
- The primary schedule MUST be represented on and synchronized with the user's digital calendar via MCP tools.
- Rescheduling and plan changes MUST happen in-app first and then synchronize with the calendar via MCP tools.
- External calendar changes MUST trigger webhooks to keep the internal plan state in sync.

### IV. Recovery Over Streaks
Consistency is measured by return speed and recovery after disruption, not perfect daily streaks. Shaming or guilt-inducing language is strictly prohibited.
- The system MUST wait exactly 2 hours (grace period) after a missed session before initiating the recovery flow.
- The recovery agent MUST NOT send more than one recovery message per missed session.
- The recovery flow MUST end with a forward-looking action (rescheduling or plan adjustment).
- In-app progress indicators MUST display weekly consistency rather than consecutive daily streaks.

### V. Specialized Agents
Specialization (onboarding, planning, recovery, reflection) is an internal prompt/role modularization pattern, not a protocol-level claim of agent independence.
- Specialized agents (Onboarding, Planning, Recovery, Reflection) MUST be stateless prompt variants.
- All Coordinator-to-specialist communications MUST use the private, structured internal JSON communication envelope.
- Specialists MUST NOT be exposed directly to users or external callers.

### VI. Coordinator as Gatekeeper
A single Coordinator routes inputs, manages conversational state, runs safety filters, and prevents cascading agent orchestration.
- All user-facing inputs and outputs MUST flow through the Coordinator.
- There MUST NOT be cascading agent chains; a maximum of 1 internal delegation per Coordinator turn is allowed.
- All specialist outputs MUST pass through the Coordinator's global safety filter (blocking guilt, shaming, medical advice, and productivity extremism).
- On agent timeout or failure, the Coordinator MUST retry once, then fall back to a safe generic response.

### VII. System Boundary Protocol Separation
Internal orchestration and external agent interoperability are separate concerns governed by different protocols.
- Internal agent-to-agent routing must use the private REST/Redis schema.
- External agent-to-agent communication must use the official A2A protocol (JSON-RPC over HTTPS and signed Agent Cards).
- External A2A requests MUST be authenticated and mapped to the Coordinator task queue (`A2ATask`), routing through the Coordinator and safety gate.
- No external A2A caller or MCP client shall bypass the Coordinator or gain direct access to specialists.

## Technical Architecture & Constraints
- **Programming Language & Hosting**: Node.js or Python (FastAPI), PostgreSQL for persistence, Vercel/Railway hosting.
- **LLM Selection**: Low-cost, high-speed models (such as GPT-4o-mini or Claude 3.5 Haiku) suitable for real-time conversation.
- **Calendar Integration (MCP)**: Custom `bloom-calendar-server` using OAuth 2.0 with PKCE and minimal scopes.
- **Interoperability (A2A)**: Signed Agent Card served at `https://bloom-for-learning.app/.well-known/agent.json` exposing three MVP skills: `plan_week`, `recovery_coaching`, `reflect_session`.

## Performance & Quality Gates
- **Latency Budgets**: p50 end-to-end response latency MUST be < 4s; p95 MUST be < 10s. Timeout budgets are capped at 4s for Onboarding, 5s for Planning, 3s for Recovery, and 3s for Reflection.
- **Safety Filtering**: Global block patterns for shaming, guilt, medical advice, and productivity extremism. Any safety filter trigger must be logged and never reach the user.
- **Verification & Testing**: At least 90% routing accuracy evaluated against a test suite of ≥200 transcripts. All A2A tasks must have matching `AgentDelegation` records.
- **Compliance Rules**: All pull requests must verify compliance with these core guidelines.

## Governance
- This constitution supersedes other development practices. Any divergence from these rules (e.g., introducing new dependencies or altering latencies) must be documented and justified in `plan.md` under the Complexity Tracking table.
- All code reviews and PR gates must verify adherence to the Core Principles and Safety Filters.
- Constitutional amendments require updating the `CONSTITUTION_VERSION` and `LAST_AMENDED_DATE` below.

**Version**: 1.1.0 | **Ratified**: 2026-06-30 | **Last Amended**: 2026-06-30
