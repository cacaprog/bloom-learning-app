# Research & Technology Decisions: Bloom Coaching Core

This document consolidates findings, tech choices, and architectural designs for the Bloom Coaching Core.

## Technology Stack: Backend Language & Framework

* **Decision**: Node.js v20 with TypeScript and Express.
* **Rationale**:
  * **MCP Integration**: Official Model Context Protocol (MCP) SDK has full, mature support in Node.js.
  * **Asynchronous Execution**: Express combined with async/await handles concurrent network calls (LLM requests, calendar updates, and state persistence) efficiently.
  * **Full-stack Shared Types**: Shares domain interfaces (e.g., `LearnerProfile`, `WeeklyPlan`) directly with the TypeScript React frontend.
* **Alternatives Considered**:
  * **Python (FastAPI)**: Good for data analysis and ML libraries. However, it was rejected because it introduces extra dependency overhead for MCP SDK configuration, which is native and more straightforward in Node.js.

## Inter-Agent Communication Pattern (Coordinator ↔ Specialist)

* **Decision**: Local module/class interface wrapping stateless function calls, passing a standardized private JSON envelope.
* **Rationale**:
  * **Low Latency**: Directly calling TS classes/modules is microsecond-fast, avoiding HTTP call overhead inside the backend process.
  * **Invariants Enforcement**: Enforces a strict one-delegation limit directly in code.
  * **Statelessness**: Specialists receive the envelope, process it, and return a result without writing to the database directly, keeping state logic centralized in the Coordinator.
* **Alternatives Considered**:
  * **Redis Message Queue / Pub-Sub**: Reconciled as unnecessary complexity for MVP scale because no cascading or long-running parallel agent pipelines are permitted.

## Calendar Integration (MCP)

* **Decision**: A custom Model Context Protocol client integrated with the `bloom-calendar-server` MCP server using OAuth 2.0 with PKCE.
* **Rationale**:
  * **Separation of Concerns**: Decouples external calendar details (Google Calendar / Outlook API scopes) from core coaching logic.
  * **Security**: Client-side calendar authentication tokens are kept secure in database sessions, and raw email or contact list access is blocked.
* **Alternatives Considered**:
  * **Direct API Integration (GCal/Microsoft Graph SDKs)**: Rejected because it duplicates OAuth and event management logic across agents, whereas MCP abstracts them as standard, reusable tools.

## Global Safety Filter

* **Decision**: Two-stage filter running synchronously in the Coordinator:
  1. **Pattern Matching**: Fast regex rules to detect blocked words/phrases (guilt-inducing patterns, crisis keywords, medical claims) in <50ms.
  2. **Bounded LLM Evaluation**: Short prompt checks running in parallel with the main response formatting where required, verifying tone.
* **Rationale**: Allows keeping median latency under 4 seconds (p50) while guaranteeing 100% safety filter coverage.
* **Alternatives Considered**:
  * **Heuristic Filter Only**: Failed to catch nuanced shaming or productivity extremism.
  * **Deep LLM Filter**: Added >2.5s to response latency, violating the p95 < 10s budget.
