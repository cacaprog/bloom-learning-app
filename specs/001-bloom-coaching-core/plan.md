# Implementation Plan: Bloom Coaching Core

**Branch**: `001-bloom-coaching-core` | **Date**: 2026-06-30 | **Spec**: [specs/001-bloom-coaching-core/spec.md](file:///home/cairo/code/bloom-learning/my-project/specs/001-bloom-coaching-core/spec.md)

**Input**: Feature specification from `specs/001-bloom-coaching-core/spec.md`

## Summary

The Bloom Coaching Core implements a responsive web application delivering state-driven self-directed learning coaching. It coordinates four specialized, stateless agents (Onboarding, Planning, Recovery, and Reflection) through a central Coordinator gatekeeper, integrates with the user's digital calendar via an MCP server, and exposes an A2A-compliant external delegation interface. The system enforces strict safety boundaries and maintains end-to-end response times below 4 seconds (p50).

## Technical Context

**Language/Version**: TypeScript / Node.js v20

**Primary Dependencies**: `express`, `@modelcontextprotocol/sdk` (MCP SDK), `pg` (PostgreSQL client), `jsonwebtoken` (A2A auth), `zod` (validation)

**Storage**: PostgreSQL

**Testing**: Jest (Unit & Integration tests)

**Target Platform**: Linux server, Vercel (Frontend), Railway (Backend)

**Project Type**: Web application (frontend + backend)

**Performance Goals**: p50 end-to-end latency < 4s, p95 < 10s (reconciled with specialist timeout/retry budgets)

**Constraints**: Max 1 specialist delegation per turn, 2-hour grace period for recovery, strict Word/Safety filters, OAuth 2.0 PKCE auth

**Scale/Scope**: MVP stage validating learner consistency, calendar sync, and A2A external integration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Principle / Rule | Compliance Status |
|------|------------------|-------------------|
| **Gate 1** | **Agency First**: No plan modification or scheduling without user agreement. | Pass. The Planning Agent only drafts options; confirmation is required. |
| **Gate 2** | **Structured Conversation**: Dialogue states are strictly managed (Onboarding S1-S6, Recovery stages). | Pass. State machines are maintained in the Coordinator. |
| **Gate 3** | **Plan & Coach Integration**: In-app actions drive calendar events via MCP tools. | Pass. Bidirectional webhook sync ensures consistency. |
| **Gate 4** | **Recovery over Streaks**: 2-hour grace period, max 1 recovery chat, no guilt/shame tone. | Pass. Timer handles grace period; Recovery Agent prompt bans shaming. |
| **Gate 5** | **Specialist Isolation**: Onboarding, Planning, Recovery, Reflection are internal, stateless, and prompt-based. | Pass. Specialists are isolated from external networks and direct user access. |
| **Gate 6** | **Coordinator Gatekeeping**: Single entry/exit, max 1 delegation per turn, global safety filtering. | Pass. Coordinator acts as the central router and safety gate. |
| **Gate 7** | **Protocol Separation**: Internal REST/Redis is separate from external JSON-RPC A2A. | Pass. Thin A2A adapter maps requests into `A2ATask` lifecycle. |

## Project Structure

### Documentation (this feature)

```text
specs/001-bloom-coaching-core/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── contracts/           # Phase 1 output
    ├── a2a-api.json     # A2A JSON-RPC interface contract
    └── mcp-tools.json   # MCP tools schemas
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── coordinator/     # State manager, safety filter, router
│   │   ├── coordinator.service.ts
│   │   └── safety.filter.ts
│   ├── specialists/     # Onboarding, Planning, Recovery, Reflection prompts
│   │   ├── onboarding.agent.ts
│   │   ├── planning.agent.ts
│   │   ├── recovery.agent.ts
│   │   └── reflection.agent.ts
│   ├── models/          # User, LearnerProfile, WeeklyPlan, etc.
│   ├── services/        # Calendar sync service, A2A adapter
│   └── api/             # A2A RPC endpoints and webhooks
└── tests/
    ├── contract/
    ├── integration/
    └── unit/

frontend/
├── src/
│   ├── components/      # ChatInterface, ProgressTracker, PlanViewer
│   ├── pages/           # Dashboard, OnboardingFlow
│   └── services/        # API client, WebSocket/SSE notifier
└── tests/
```

**Structure Decision**: Web application layout split into `backend/` and `frontend/` directories to facilitate independent deployment (Vercel/Railway) and testing of the Coordinator and web client.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution check violations exist. The architectural design fully adheres to all project rules.
