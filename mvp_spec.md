# Bloom-for-Learning: MVP Specification
## Multi-Agent Orchestration + A2A External Interface

**Version:** 1.1
**Date:** 2026-06-30
**Status:** Implementation-ready
**Changelog from v1.0-a2a:** Renamed internal routing pattern away from "A2A" (it is a Coordinator/specialist orchestration pattern, not the A2A protocol — see §6.0). Retired two under-specified agents that had no trigger path (§6.2). Reconciled latency NFRs against per-agent timeout budgets (§8.5, §14.5). Added a genuine A2A-compliant external interface (§19) so Bloom can be discovered and delegated to by outside agents.

---

## 1. Product Overview

**Product name:** Bloom-for-Learning MVP
**Product type:** LLM coaching app with internal multi-agent orchestration, calendar integration, and an A2A-compliant external interface
**Primary goal:** Validate that a facilitative, state-driven coaching approach with specialized internal agents improves learner consistency and mindset in self-directed learning.
**Core hypothesis:** A nonprescriptive coach that helps learners discover their own motivations, co-create weekly plans, and recover gracefully from disruptions will produce better mindset outcomes than plan-only or prescriptive-advice approaches.

**What we're testing:**
- Will users complete a structured onboarding interview (5-8 min)?
- Will they engage with a coach for weekly planning instead of just receiving a generated plan?
- Will recovery interactions after missed sessions feel supportive rather than punitive?
- Does calendar integration increase plan adherence?
- Does splitting the coaching engine into specialized internal agents improve response quality over a single-prompt approach, without adding unacceptable latency?

**What we're NOT building yet:**
- Daily check-ins or proactive mid-week check-ins (weekly touchpoints only)
- Rich ambient display (simple progress indicator)
- Content tutoring or resource recommendations
- Social features or gamification
- Mobile native app (responsive web only)
- Multi-intent cascading agent chains (max 1 internal delegation per turn)
- Additional MCP integrations beyond calendar
- Open-ended "ask me anything" coaching outside the four structured flows (see §6.2 design note)

---

## 2. Problem Statement

Self-learners fail not from lack of information but from:
- **Direction drift:** No clear next step when motivation dips
- **All-or-nothing thinking:** One missed session becomes a week abandoned
- **Self-judgment:** Internal criticism after inconsistency kills momentum
- **Planning friction:** Creating a realistic plan takes willpower they don't have

Existing solutions are either:
- **Prescriptive:** "Follow this 12-week curriculum" (ignores barriers, kills agency)
- **Passive:** Trackers and calendars with no coaching layer (no mindset support)
- **Generic chat:** Ask an LLM for a study plan (no structured follow-through, no recovery)

---

## 3. Product Principles

1. **Agency first.** The learner owns goals and decisions. The coach asks, reflects, and collaborates — never commands.
2. **Structured conversation.** Every coaching interaction follows explicit states. No free-form drift.
3. **Plan + Coach, not Plan OR Coach.** The calendar and progress UI are primary; the coach activates when needed (planning, recovery, reflection).
4. **Recovery over streaks.** A missed session triggers support, not shame. Progress is measured by return speed, not perfection.
5. **Specialized agents for specialized contexts.** Onboarding, planning, recovery, and reflection each have dedicated behavior — but specialization is an internal implementation detail, not a claim of protocol-level agent independence.
6. **Coordinator as gatekeeper.** A single component routes, manages state, enforces safety, and prevents fragmentation.
7. **Say what a thing is.** Internal orchestration and external agent interoperability are different problems with different protocols. We don't conflate them (see §6.0).

---

## 4. Target User (MVP)

**Primary persona:** Adult self-learner, 25-40, learning a technical or professional skill (programming, data science, design, language) outside formal education.

**Key characteristics:**
- Has tried self-learning before, stopped and restarted multiple times
- Has 5-10 hours/week available but schedule is irregular
- Uses digital calendar (Google/Outlook) for other life commitments
- Feels guilty about inconsistency but doesn't know how to fix the pattern
- Skeptical of "productivity hacks" but open to structured support

**Secondary persona:** Career-changer preparing for interviews or certification, needs sustained study over 8-12 weeks.

---

## 5. User Outcomes (MVP)

- Complete onboarding and feel understood (not interrogated)
- Have a weekly learning plan that feels realistic and owned
- Experience one recovery interaction after a missed session that feels supportive
- See progress in a way that validates effort, not just completion
- Self-report higher confidence in ability to continue learning after 3 weeks

---

## 6. Multi-Agent Orchestration (Internal)

### 6.0 What this is — and isn't

This layer is a **Coordinator/specialist orchestration pattern**, sometimes called hub-and-spoke or supervisor-worker. It is **not** the A2A (Agent2Agent) protocol. The distinction matters for implementation and for how this system claims interoperability:

| Property | This layer (internal) | A2A protocol (§19) |
|---|---|---|
| Agent discovery | Hardcoded directory (§6.2) | Agent Cards, published and discoverable |
| State ownership | Coordinator owns all state; specialists are stateless | Each agent owns its own state; opaque to callers |
| Message format | Custom JSON envelope (§6.3) | A2A Message / Task / Artifact objects |
| Transport | Internal REST + Redis | JSON-RPC or gRPC over HTTPS |
| Independence | Specialists are prompt variants of the same system, same deploy | Agents can be built by different teams/vendors, deployed independently |

Both are legitimate patterns. We use internal orchestration for the coaching loop because the specialists share state, safety rules, and a deploy — genuine independence would add cost with no benefit. We use real A2A only at the system boundary (§19), where independence and discoverability are the actual point.

### 6.1 Pattern: Hub-and-Spoke with Coordinator

All user-facing interactions flow through a single Coordinator that routes to specialized internal agents, aggregates responses, enforces safety, and maintains canonical state.

```
                    User (Frontend)
                         │
                         ▼
              ┌─────────────────────┐
              │     Coordinator     │
              │  Router · State ·   │
              │  Safety · Memory    │
              └──────────┬──────────┘
                         │
              ┌──────────┼──────────┬──────────┐
              ▼          ▼          ▼          ▼
         Onboarding  Planning   Recovery   Reflection
           Agent      Agent      Agent      Agent
```

### 6.2 Agent Directory

| Agent | ID | Role | Scope | Triggered by |
|-------|-----|------|-------|---------------|
| Coordinator | `coordinator` | Central router, state machine, safety enforcer | All user-facing interactions | Every inbound message |
| Onboarding | `onboarding` | Structured MI interview for LearnerProfile | States S1-S6 | New user, incomplete profile |
| Planning | `planning` | Weekly plan co-creation with calendar sync | Plan generation, modification | Onboarding complete, Sunday evening, recovery-triggered adjustment (§9.4) |
| Recovery | `recovery` | Missed session coaching with barrier focus | Recovery flow stages | Missed session + 2h grace period (§9.3) |
| Reflection | `reflection` | Post-session and weekly reflection prompts | Reflection processing | Session completion, week end, recovery completion (§9.3, §10.2) |

**Design note — Check-in and On-Demand agents retired.** The prior draft (v1.0-a2a) defined a Check-in agent and an On-Demand agent with invariants but no trigger path anywhere in the workflow layer (§9) — they were reachable from nowhere. Rather than wire them in now, we're cutting them for the same reason v1.0 originally excluded daily check-ins and content tutoring: the MVP's job is to validate the four-flow core loop first. Proactive mid-week check-ins and open-ended on-demand coaching are real ideas — they're moved to §17 (Post-MVP Roadmap) with an explicit note to revisit once the four specialists above have real usage data. Out-of-flow user messages (anything that doesn't match an onboarding/planning/recovery/reflection intent) are handled directly by the Coordinator with a single bounded response and a redirect to the nearest structured flow — no dedicated agent needed for that at MVP scale.

### 6.3 Internal Communication Envelope

All Coordinator ↔ specialist messages use a structured envelope. This is a private, internal schema — it is not the A2A wire format, and no external system should assume compatibility with it.

```json
{
  "message_id": "uuid",
  "timestamp": "ISO-8601",
  "from_agent": "agent_name",
  "to_agent": "agent_name",
  "message_type": "delegate | respond | notify | error",
  "payload": {},
  "context": {
    "session_id": "uuid",
    "user_id": "uuid",
    "conversation_state": "enum",
    "priority": "low | medium | high | critical"
  },
  "trace": ["message_id_1", "message_id_2"]
}
```

**Message Types:**
- `delegate`: Coordinator assigns task to specialist
- `respond`: Specialist returns result to coordinator
- `notify`: Async update (e.g., calendar sync complete)
- `error`: Failure or exception report

### 6.4 Coordinator Rules

| Rule | Description |
|------|-------------|
| **Single entry/exit** | All user messages enter through Coordinator; all responses exit through Coordinator |
| **Max 1 delegation per turn** | No cascading agent chains in MVP |
| **State ownership** | Coordinator maintains canonical conversation state; specialists are stateless |
| **Safety gate** | All specialist outputs pass through Coordinator's safety filter before user delivery |
| **No internal exposure** | Agent names, reasoning, or delegation logic are never exposed to users |
| **Failure fallback** | Agent timeout → retry once → safe generic response |

### 6.5 Timeout & Retry Rules

Per-agent budgets. These are worst-case ceilings, not typical latency — see §8.5 for the reconciled NFR.

| Agent | Timeout | Retry | Worst case (timeout + 1 retry) | Fallback Action |
|-------|---------|-------|-------------------------------|-----------------|
| Onboarding | 4s | 1 | 8s | Safe continuation prompt |
| Planning | 5s | 1 | 10s | Simplified plan draft |
| Recovery | 3s | 1 | 6s | Generic supportive message |
| Reflection | 3s | 0 | 3s | Skip reflection |

---

## 7. Layer 1: Onboarding Interview

### 7.1 Purpose
Build a structured learner profile through a facilitative, state-driven conversation. Adapted from Bloom's Stanford Active Choices interview and motivational interviewing principles.

### 7.2 Dialog States

| State | Purpose | Key Questions | Exit Condition |
|-------|---------|---------------|----------------|
| **S1: Welcome** | Set tone, explain process | "I'll ask about your goals and what has/hasn't worked. There are no wrong answers." | User confirms readiness |
| **S2: Goal Discovery** | Uncover intrinsic motivation | "What made you want to learn this?" "What would change for you if you succeeded?" | Primary goal articulated |
| **S3: History & Barriers** | Understand past attempts | "What have you tried before? What got in the way?" | At least 2 barriers identified |
| **S4: Context & Resources** | Map real-world constraints | "When do you feel most focused?" "How much time do you actually have?" | Time budget + preferences captured |
| **S5: Readiness Check** | Assess confidence and stage | "On a scale of 1-10, how confident are you?" "What would move you up one point?" | Confidence score + readiness stage |
| **S6: Summary & Confirm** | Validate understanding | System summarizes profile; user edits or confirms | User confirms accuracy |

### 7.3 Onboarding Agent Invariants
- **NEVER** prescribe plans during onboarding
- **NEVER** make identity assumptions
- **ALWAYS** ask open questions before closed
- **ALWAYS** summarize and confirm before exiting
- **MAX 3** messages per state before gentle progression

### 7.4 Allowed Strategies
- `open_question` — "What made you want to learn this?"
- `reflection_simple` — "So you're looking for a change in your career."
- `reflection_complex` — "It sounds like you've tried before and felt frustrated when the structure didn't match your life."
- `affirmation` — "It takes honesty to recognize what hasn't worked."
- `summary` — "Let me make sure I have this right..."
- `scaling_question` — "On a scale of 1-10, how confident do you feel?"

### 7.5 Forbidden Behaviors
- Unsolicited advice
- Premature planning ("You should study 1 hour daily")
- Identity assumptions
- Multiple questions at once
- Moralizing or should-statements

### 7.6 Output: LearnerProfile Object

```json
{
  "profile_id": "uuid",
  "created_at": "timestamp",
  "primary_goal": "string (user's own words)",
  "goal_category": "technical | professional | creative | language | other",
  "motivation_reasons": ["string"],
  "past_attempts": [
    {
      "what": "string",
      "what_helped": "string",
      "what_hindered": "string"
    }
  ],
  "barriers": [
    {
      "type": "time | energy | direction | self_doubt | environment | other",
      "description": "string",
      "severity": 1-10
    }
  ],
  "resources": {
    "best_time": "morning | midday | evening | variable",
    "weekly_time_budget_hours": number,
    "preferred_formats": ["reading | video | project | practice | mixed"],
    "existing_tools": ["string"]
  },
  "confidence_score": 1-10,
  "readiness_stage": "contemplation | preparation | action | maintenance",
  "success_definition": "string (user's own words)"
}
```

### 7.7 Acceptance Criteria
- [ ] User completes onboarding in 5-8 minutes
- [ ] 100% of required fields captured (system enforces progression)
- [ ] User can edit summary before confirmation
- [ ] No plan generated until profile is confirmed
- [ ] Conversation stays on-state in ≥90% of turns (evaluated via transcript review)

---

## 8. Layer 2: Coaching Engine (Coordinator + Specialists)

### 8.1 Purpose
Generate autonomy-supportive, state-consistent coaching responses using specialized internal agents coordinated by a central router.

### 8.2 Flow Architecture

```
User Message
    │
    ▼
┌─────────────────┐
│  Coordinator     │ ← Determines intent, current state, routes to specialist
│  (State Manager) │
└─────────────────┘
    │
    ▼ (delegate)
┌─────────────────┐
│  Specialist      │ ← Generates response using domain-specific strategies
│  Agent           │
└─────────────────┘
    │
    ▼ (respond)
┌─────────────────┐
│  Coordinator     │ ← Aggregates, applies safety filter
│  (Safety Gate)   │
└─────────────────┘
    │
    ▼
Output to User
```

### 8.3 Specialist Agent Behaviors

#### Planning Agent
**Invariants:**
- **NEVER** impose a plan without explicit user agreement
- **ALWAYS** present draft as starting point: "Here's a starting point..."
- **ALWAYS** offer choices, never single options
- **ALWAYS** respect weekly_time_budget from profile (±10% tolerance)
- **NEVER** schedule during user's identified blocked times

**Allowed Strategies:**
- `choice_framing` — "Would you prefer 30 minutes Tuesday morning or 45 minutes Wednesday evening?"
- `collaborative_planning` — "What if we tried two shorter sessions instead of one long one?"
- `reflection` — "You mentioned mornings feel best. How does that fit with what we're building?"
- `confidence_scaling` — "On a scale of 1-10, how doable does this feel?"
- `barrier_exploration` — "You said work drains you by evening. Should we protect morning time?"
- `summary` — "So we're looking at three sessions: Monday morning, Wednesday lunch, Saturday afternoon."

#### Recovery Agent
**Invariants:**
- **NEVER** send recovery message before 2-hour grace period
- **NEVER** use guilt, shame, comparison, or "should" language
- **ALWAYS** assume legitimate reason for miss
- **ALWAYS** end with forward-looking action (reschedule OR adjust)
- **NEVER** send more than 1 recovery message per missed session

**Recovery Stage Machine:**
```
INITIATE → EXPLORE → RESOLVE → COMPLETE
```

**Allowed Strategies:**
- `reflection` — "So work ran late and starting felt impossible."
- `normalization` — "Many people find their energy is lowest after a long day."
- `barrier_exploration` — "What usually helps when you're tired but want to do something?"
- `choice_framing` — "Would you like to reschedule this session or adjust next week's plan?"
- `affirmation` — "Coming back after a miss is what consistency actually looks like."
- `reframe_partial_progress` — "You planned 30 minutes and didn't make it. That doesn't erase your other progress this week."

#### Reflection Agent
**Invariants:**
- **NEVER** judge quality or completeness of reflection
- **ALWAYS** make reflection optional (no penalty for skipping)
- **ALWAYS** connect reflection to user agency ("You noticed..." not "I noticed...")
- **NEVER** use reflections to guilt user

**Prompt Templates:**
- **Post-Session:** "Nice work showing up. Quick check: What helped you get started today? (Skip if you're on a roll — no pressure)"
- **Weekly:** "Let's look back. What felt like a win this week — however small? And what would you tweak for next week?"
- **Recovery:** "You missed a session and came back. That matters more than perfection. What helped you return?"

### 8.4 Safety Filter (Global)

Applied by Coordinator to ALL specialist outputs before user delivery.

**Blocked Patterns:**
- Shaming or guilt-inducing language ("You should have...", "Why didn't you...")
- Absolutist claims ("This always works...")
- Identity assumptions ("As a developer, you...")
- Medical or mental health advice
- Productivity extremism ("Sleep less", "No excuses")
- Overdependence cues ("I know what's best for you")

**Escalation Rules:**
- User expresses severe distress or crisis language → Stop coaching, provide crisis resources, flag for human review
- Repeated safety filter triggers → Agent review + prompt revision

### 8.5 Non-Functional Requirements

Reconciled against §6.5's per-agent timeout budgets:

| Percentile | Target | Basis |
|---|---|---|
| p50 (median) end-to-end | < 4s | Coordinator routing (~200ms) + single specialist call under normal load, no retry |
| p95 end-to-end | < 10s | Covers the worst single-agent timeout+retry path (Planning: 10s) plus Coordinator overhead |
| p99 end-to-end | < 12s | Accounts for safety-filter re-check on retry |

- Max response length: 150 words
- Tone: warm, curious, nonjudgmental

### 8.6 Acceptance Criteria
- [ ] < 5% of responses contain premature advice (evaluated in test transcripts)
- [ ] 100% of responses pass safety filter before delivery
- [ ] Users rate tone as supportive in post-session survey (target: ≥4/5)
- [ ] Agent delegation accuracy ≥90% (Coordinator routes to correct specialist, measured against a labeled test set of ≥200 transcripts)
- [ ] p50 and p95 latency targets in §8.5 met under expected MVP load (measured via `AgentDelegation` records, §12.1)

---

## 9. Layer 3: Workflow System

### 9.1 Weekly Planning Flow

**Trigger:** User completes onboarding OR Sunday evening (configurable)

**Process:**
1. Coordinator detects planning intent → delegates to Planning Agent
2. Planning Agent generates draft from LearnerProfile + calendar availability
3. Coach initiates planning chat: "Here's a starting point based on what you shared. What feels right or off about this?"
4. User and coach iterate: adjust session count, duration, topics, timing
5. User confirms plan
6. Planning Agent syncs to calendar via MCP
7. Coordinator confirms to user

**Plan Object:**

```json
{
  "plan_id": "uuid",
  "week_start": "date",
  "sessions": [
    {
      "session_id": "uuid",
      "scheduled_at": "datetime",
      "duration_minutes": number,
      "topic": "string",
      "format": "reading | practice | project | review",
      "effort_level": "light | moderate | deep",
      "status": "planned | completed | missed | rescheduled",
      "calendar_event_id": "string (from MCP)"
    }
  ],
  "weekly_goal": "string",
  "flexibility_note": "string (user's contingency plan)"
}
```

### 9.2 Calendar Integration (MCP)

**MCP Server:** `bloom-calendar-server`

**Exposed Tools:**

| Tool | Direction | Purpose | Accessed By |
|------|-----------|---------|-------------|
| `calendar.create_events` | Write | Push planned sessions to user's calendar | Planning Agent |
| `calendar.update_event` | Write | Reschedule or modify session | Planning Agent |
| `calendar.delete_event` | Write | Remove cancelled session | Planning Agent |
| `calendar.get_free_busy` | Read | Check availability during planning | Planning Agent |
| `calendar.list_upcoming` | Read | Verify sessions exist, detect conflicts | Planning Agent |

**Integration Rules:**
- Calendar events include: title ("Bloom: Python Practice"), time, duration, and a link back to the app
- Events are marked as "tentative" until user confirms in-app
- Rescheduling happens in-app first, then syncs to calendar
- If user modifies event in calendar directly, MCP webhook updates plan status

**MCP Security:**
- OAuth 2.0 with minimal scopes (calendar.events only, no email/contacts)
- User can revoke access anytime
- No raw calendar data stored; only event IDs and sync timestamps

### 9.3 Reminder System

| Trigger | Channel | Content |
|---------|---------|---------|
| 15 min before session | Push + email | "Your [topic] session starts soon. Ready when you are." |
| 2 hours after missed session | In-app chat | Recovery flow initiated (Coordinator → Recovery Agent) |
| Sunday evening | Email | "Let's plan your week" with one-click planning start |
| End of week | In-app | Weekly reflection prompt (Coordinator → Reflection Agent) |

### 9.4 Recovery Flow (after missed session)

1. System detects missed session (via calendar sync or user check-in)
2. Wait 2 hours (grace period)
3. Coordinator delegates to Recovery Agent
4. Recovery Agent sends: "I noticed you missed your [topic] session. No judgment—life happens. What got in the way?"
5. Based on user response, Recovery Agent selects strategy and stage
6. Recovery Agent guides to reschedule or adjust plan
7. If plan adjustment needed, Recovery Agent requests Coordinator to delegate to Planning Agent (this is the one case where a second delegation happens in the same user-visible flow — it's sequential, not cascading, and stays within the "max 1 delegation per Coordinator turn" rule because each delegation is its own turn)
8. Coordinator aggregates and delivers final response

### 9.5 Progress Tracking (Minimal)

**Visible in UI:**
- This week's planned vs. completed sessions (simple bar)
- Current streak of weeks with ≥1 completed session (not daily streaks)
- Last recovery: how quickly user returned after last miss

**NOT in MVP:**
- Points, badges, leaderboards
- Complex ambient displays
- Long-term trend charts

### 9.6 Acceptance Criteria
- [ ] User creates weekly plan in < 3 minutes after onboarding
- [ ] Calendar sync succeeds ≥95% of attempts
- [ ] Missed session triggers recovery flow within 2 hours
- [ ] Any session can be rescheduled in ≤2 interactions
- [ ] Recovery interaction completes with plan adjustment or continuation in ≥80% of cases

---

## 10. Layer 4: Reflection (Minimal)

### 10.1 Purpose
Build self-awareness and normalize partial progress. Single prompt per trigger, processed by Reflection Agent.

### 10.2 Reflection Flow

1. Trigger event occurs (session completion, week end, recovery complete)
2. Coordinator detects trigger → delegates to Reflection Agent
3. Reflection Agent generates context-appropriate prompt
4. User responds (optional)
5. Reflection Agent processes for insights, updates profile if patterns detected
6. Coordinator delivers affirmation/summary to user

### 10.3 Storage

```json
{
  "reflection_id": "uuid",
  "type": "post_session | weekly | recovery",
  "session_id": "uuid?",
  "user_response": "string",
  "coach_response": "string",
  "insight_extracted": "string?",
  "profile_update": "object?",
  "timestamp": "datetime"
}
```

### 10.4 Acceptance Criteria
- [ ] Reflection prompt appears within 1 hour of trigger event
- [ ] User can skip without penalty
- [ ] Reflections are visible in weekly review

---

## 11. MCP Server Specification

### 11.1 Server: `bloom-calendar-server`

**Purpose:** Enable external calendar systems to read learning plans and write session completions, while preserving Bloom's state machine and safety boundaries.

### 11.2 Exposed Tools

#### `bloom.getLearnerProfile`
```json
{
  "name": "bloom.getLearnerProfile",
  "description": "Read anonymized learner goals, barriers, and preferences",
  "parameters": {},
  "returns": {
    "primary_goal": "string",
    "goal_category": "string",
    "weekly_time_budget_hours": "number",
    "best_time": "string",
    "preferred_formats": ["string"],
    "confidence_score": "number",
    "readiness_stage": "string"
  },
  "notes": "No raw chat history. No personally identifying information."
}
```

#### `bloom.getCurrentPlan`
```json
{
  "name": "bloom.getCurrentPlan",
  "description": "Read this week's learning plan with session details",
  "parameters": {},
  "returns": {
    "week_start": "date",
    "sessions": [
      {
        "session_id": "string",
        "scheduled_at": "datetime",
        "duration_minutes": "number",
        "topic": "string",
        "format": "string",
        "status": "string",
        "calendar_event_id": "string"
      }
    ]
  }
}
```

#### `bloom.logSessionCompletion`
```json
{
  "name": "bloom.logSessionCompletion",
  "description": "Record a completed learning session from an external tool",
  "parameters": {
    "session_id": "string?",
    "topic": "string",
    "duration_minutes": "number",
    "source_tool": "string",
    "notes": "string?",
    "idempotency_key": "string"
  },
  "returns": {
    "success": "boolean",
    "reflection_triggered": "boolean",
    "recovery_needed": "boolean"
  },
  "notes": "If session_id not provided, system matches to nearest planned session. Validates duration against plan. idempotency_key required to prevent duplicate logging on client retry."
}
```

#### `bloom.requestCoaching`
```json
{
  "name": "bloom.requestCoaching",
  "description": "Request a coaching interaction for a specific situation",
  "parameters": {
    "situation_type": "missed_session | stuck | low_motivation | post_completion | planning",
    "context": "string (max 200 chars)",
    "urgency": "low | medium | high"
  },
  "returns": {
    "coaching_message": "string",
    "suggested_action": "string?",
    "state": "string"
  },
  "notes": "Response generated by internal coaching engine (Coordinator + Specialist). External tool cannot inject raw messages."
}
```

#### `bloom.triggerReflection`
```json
{
  "name": "bloom.triggerReflection",
  "description": "Prompt user for reflection after an activity",
  "parameters": {
    "prompt_type": "post_session | end_of_week | recovery",
    "context": "string?"
  },
  "returns": {
    "success": "boolean",
    "prompt_text": "string"
  }
}
```

### 11.3 Authentication & Security
- OAuth 2.0 with PKCE
- Scope per tool (granular permissions)
- Rate limiting: 100 requests/hour per user per tool
- All requests include `X-Bloom-User-ID` header
- Audit log of all MCP calls retained 30 days

### 11.4 What Is NOT Exposed
- Raw chat history
- Direct LLM prompt access
- Profile write (external tools cannot modify learner profile)
- Memory service direct access
- Safety filter bypass
- Internal Coordinator/specialist orchestration details (§6) — external callers only ever see the A2A interface (§19) or MCP tools (§11), never the internal envelope (§6.3)

---

## 12. Data Model (MVP)

### 12.1 Core Entities

```
User
├── id (UUID)
├── email
├── created_at
├── profile: LearnerProfile
├── current_plan: WeeklyPlan
├── sessions: LearningSession[]
├── reflections: ReflectionEntry[]
└── calendar_credentials: CalendarAuth

LearnerProfile (see 7.6)

WeeklyPlan (see 9.1)

LearningSession
├── id (UUID)
├── plan_id (UUID)
├── scheduled_at (datetime)
├── duration_minutes (int)
├── topic (string)
├── format (enum)
├── effort_level (enum)
├── status (enum)
├── calendar_event_id (string)
├── completed_at (datetime?)
├── completion_source (app | mcp | a2a | manual)
└── notes (string?)

ReflectionEntry (see 10.3)

CoachMessage
├── id (UUID)
├── session_id (UUID?)
├── agent_id (string)
├── mode (enum)
├── state (enum)
├── strategy (enum?)
├── content (string)
├── created_at
└── safety_check_passed (boolean)

AgentDelegation
├── id (UUID)
├── coordinator_message_id (UUID)
├── from_agent (string)
├── to_agent (string)
├── task (string)
├── payload (JSON)
├── response (JSON?)
├── status (pending | completed | failed | timeout)
├── started_at
└── completed_at

A2ATask  (see 19.4 — distinct from AgentDelegation; tracks external requests, not internal routing)
├── id (UUID, matches A2A task id)
├── skill_id (string)
├── external_caller (string, from Agent Card auth)
├── state (submitted | working | input-required | completed | failed)
├── input_message (JSON)
├── artifact (JSON?)
├── created_at
└── updated_at
```

### 12.2 State Machine

```
[NEW USER]
    │
    ▼
[ONBOARDING] ──(profile confirmed)──► [PLANNING]
    │                                        │
    │(incomplete)                            │(plan confirmed)
    ▼                                        ▼
[INACTIVE]                              [ACTIVE WEEK]
    │                                        │
    │(re-engagement)              ┌──────────┼──────────┐
    └────────────────────────────┤          │          │
                                 ▼          ▼          ▼
                           [SESSION] [MISSED] [REFLECTION]
                           (completed)  │       (completed)
                                 │      ▼              │
                                 │ [RECOVERY]         │
                                 │      │             │
                                 └──────┴─────────────┘
                                        │
                                        ▼
                                  [NEXT WEEK]
```

---

## 13. User Flows

### 13.1 First-Time User (Happy Path)

1. **Landing:** Value prop: "Finally, a coach that helps you stick with learning—not just tells you what to study."
2. **Onboarding:** 5-8 min structured chat with Onboarding Agent. User feels heard.
3. **First Plan:** Planning Agent presents draft based on profile. User adjusts. 2-3 min.
4. **Calendar Sync:** One-click Google/Outlook connect. Events appear.
5. **First Week:** Reminders fire. User completes 2/3 sessions.
6. **Missed Session:** Recovery flow initiated 2 hours later. Recovery Agent: "What got in the way?" User reschedules.
7. **Weekend Reflection:** Reflection Agent: "What felt like a win?" User notes: "I came back after missing one."
8. **Next Week:** Plan adjusts based on reflection. Cycle continues.

### 13.2 Recovery Flow (Critical Path)

1. Session marked missed (no check-in after scheduled time + 2 hours)
2. Coordinator detects trigger, delegates to Recovery Agent
3. Recovery Agent (INITIATE stage): "I noticed you missed your [topic] session. No judgment—life happens. What got in the way?"
4. User responds (e.g., "Work ran late, I was too tired")
5. Recovery Agent (EXPLORE stage): "So work drained your energy, and starting a session felt impossible."
6. Recovery Agent explores: "When you've managed to study after a long day before, what helped?"
7. User: "If I do it in the morning before work, I'm better."
8. Recovery Agent (RESOLVE stage): "Morning sessions work better for you. Want to try shifting one session earlier next week?"
9. Recovery Agent requests plan adjustment → Coordinator delegates to Planning Agent
10. Planning Agent updates plan, syncs calendar
11. Recovery Agent (COMPLETE stage): Confirms change, affirms resilience
12. Coordinator aggregates and delivers final response to user

### 13.3 External Agent Delegation (New — via A2A, see §19)

1. An external agent (e.g., a university advising system) holds a delegated task from its own user, who is also a Bloom user
2. External agent fetches Bloom's Agent Card, discovers the `plan_week` skill
3. External agent sends an A2A task request with the skill input
4. Bloom's A2A interface authenticates the caller, opens an internal Coordinator session on the user's behalf, delegates to Planning Agent exactly as in §9.1
5. Bloom returns an A2A Artifact containing the resulting plan summary
6. The external agent incorporates the artifact into its own response to its user — without ever seeing Bloom's internal state, prompts, or specialist structure

---

## 14. Metrics & Success Criteria

### 14.1 Activation (Week 0-1)
| Metric | Target | Measurement |
|--------|--------|-------------|
| Onboarding completion rate | ≥70% | % of signups who confirm profile |
| Onboarding time | 5-8 min median | Timestamp analysis |
| First plan created | ≥60% of onboarded | Plan store |
| Calendar connected | ≥50% of onboarded | Auth records |

### 14.2 Engagement (Week 1-4)
| Metric | Target | Measurement |
|--------|--------|-------------|
| Weekly active users (WAU) | ≥40% of cohort | Session logs |
| Sessions completed / planned | ≥50% | Plan vs. completion |
| Recovery flow completion | ≥60% of triggered | Recovery state exits |
| Reflection response rate | ≥30% | Reflection entries |

### 14.3 Mindset (Week 3 Survey)
| Metric | Target | Measurement |
|--------|--------|-------------|
| Self-efficacy score (1-10) | +1.5 pts vs. onboarding | Same scale question |
| Satisfaction with learning | ≥6/10 | Single question |
| Confidence to continue | ≥7/10 | Single question |
| "Coach felt supportive" | ≥4/5 | Post-interaction rating |

### 14.4 Internal Orchestration Quality
| Metric | Target | Measurement |
|--------|--------|-------------|
| Agent delegation accuracy | ≥90% | Manual review against labeled test set (≥200 transcripts) |
| Specialist response latency | p95 < 10s | `AgentDelegation` logs (§12.1) — reconciled with §6.5/§8.5 |
| Agent timeout rate | <5% | Error logs |
| Off-topic response rate | <5% | Manual transcript review (n=100) |
| Safety filter triggers | Logged, 0 reach user | Filter logs |

### 14.5 A2A External Interface Quality (New)
| Metric | Target | Measurement |
|--------|--------|-------------|
| Task acceptance latency | p95 < 1s | Time from A2A task submission to `working` state |
| Task completion latency | p95 < 12s | Time from `submitted` to `completed`/`failed` — matches internal p95+overhead |
| Malformed/unauthorized request rejection rate | 100% | Requests missing valid auth or a recognized skill_id must never reach the Coordinator |

### 14.6 System Quality
| Metric | Target | Measurement |
|--------|--------|-------------|
| Calendar sync failure rate | <5% | MCP error logs |
| End-to-end response latency (in-app) | p50 < 4s | Frontend telemetry |
| System availability | ≥99% | Uptime monitoring |

---

## 15. Technical Stack (Suggested)

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript, responsive web |
| Backend | Node.js or Python (FastAPI) |
| Database | PostgreSQL |
| LLM | GPT-4o-mini or Claude 3.5 Haiku (cost-effective, sufficient for MVP) |
| Internal agent communication | REST API (sync) + Redis (async notifications) |
| External agent communication | A2A protocol (JSON-RPC over HTTPS) — see §19 |
| Calendar MCP | Custom server wrapping Google Calendar API + Outlook Graph API |
| Auth | Auth0 or Clerk (in-app) + OAuth 2.0 (A2A + MCP callers) |
| Hosting | Vercel (frontend) + Railway/Render (backend) |
| Notifications | OneSignal or Postmark |
| Monitoring | Datadog or Sentry |

---

## 16. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Internal orchestration latency exceeds target | High | Max 1 delegation per turn; smaller LLM models; caching common responses; reconciled NFRs in §8.5 |
| Users find onboarding too long | High | A/B test 5-min vs. 8-min version; progressive profiling fallback |
| Agent routing errors | High | Extensive intent classification training; manual review first 200 transcripts |
| LLM drifts from MI style | High | Strict prompt templates per agent; safety filter; invariant enforcement |
| Calendar integration complexity | Medium | Start with Google Calendar only; Outlook in v2 |
| Users ignore recovery chats | Medium | Test timing (2h vs. 6h vs. next day); allow email fallback |
| "Just another planner" perception | High | Emphasize coaching differentiation in onboarding; measure mindset scores |
| Cost of LLM calls scales poorly | Medium | Use smaller models; cache common responses; limit conversation length |
| Agent coordination bugs | Medium | Comprehensive integration tests; clear timeout/retry rules; fallback responses |
| A2A interface exposes internal state or bypasses safety filter | High | A2A tasks route through the same Coordinator + safety gate as in-app messages (§19.3); no direct specialist access from outside |
| External caller abuses A2A interface (spam tasks, scraping) | Medium | Rate limiting per Agent Card credential; task quota per user per day |

---

## 17. Post-MVP Roadmap (Not in Scope)

| Feature | Rationale |
|---------|-----------|
| Daily check-ins | More touchpoints, but adds noise; validate weekly first |
| Proactive mid-week check-in agent | Retired from v1.0-a2a draft — no trigger path defined; revisit once core 4 flows have usage data |
| On-demand open-ended coaching agent | Retired from v1.0-a2a draft — same reason; Coordinator handles out-of-flow messages directly at MVP scale |
| Rich ambient display | Bloom's flowers worked for health; need to test learning metaphor |
| Content tutoring | Scope creep; stay motivation-only until core loop is proven — candidate for A2A delegation to an external tutoring agent rather than building in-house (§19) |
| Social features | Accountability partners, but adds complexity and comparison risk |
| Multi-intent cascading chains | Only if single delegation proves insufficient |
| Mobile native app | Responsive web sufficient for MVP validation |
| Additional MCP tools (IDE, note apps) | Calendar is highest-impact integration first |
| Advanced internal multi-agent reasoning | Only if current Coordinator pattern fails at scale |
| Additional A2A skills beyond `plan_week`/`recovery_coaching`/`reflect_session` | Ship the narrow interface first, expand based on real external callers |

---

## 18. Appendix: Example Prompts

### A. Coordinator System Prompt

```
You are the Coordinator for Bloom-for-Learning, a supportive self-learning coach.

Your role:
1. Receive all user messages (from the in-app frontend OR from the A2A interface, §19)
2. Determine the user's intent and current conversation state
3. Route to the appropriate specialist agent (MAX 1 delegation per turn)
4. Receive the specialist's response
5. Apply the safety filter
6. Deliver the final response to the caller (user-facing text, or an A2A Artifact)

Current state: {current_state}
User message: {user_message}
Conversation history: {last_10_messages}

Routing rules:
- If state is onboarding (S1-S6): delegate to onboarding agent
- If intent is plan creation/modification: delegate to planning agent
- If trigger is missed session: delegate to recovery agent
- If trigger is reflection: delegate to reflection agent
- Otherwise: handle directly with a single bounded response and redirect to nearest structured flow

Safety rules:
- Block any response containing shame, guilt, absolutist claims, or productivity extremism
- Ensure all responses are ≤150 words
- Never expose internal agent names or reasoning

Output format:
{
  "response_to_user": "string",
  "new_state": "enum",
  "agent_delegation": { "agent": "string", "task": "string" } | null,
  "safety_check": { "passed": true, "flags": [] }
}
```

### B. Onboarding: Goal Discovery State

```
You are the Onboarding Specialist for Bloom-for-Learning. You are in the GOAL DISCOVERY state (S2).

Context:
- User is learning: {goal_category}
- This is their first learning goal conversation
- Current turn in state: {turn_count}/5

Your task:
Ask ONE open-ended question to understand their intrinsic motivation for learning this skill.

Allowed strategies: open_question, reflection_simple, reflection_complex, affirmation, summary, scaling_question
Forbidden: advice, prescription, planning, comparison, identity_assumptions, multiple_questions

Invariants:
- NEVER prescribe plans during onboarding
- NEVER make identity assumptions
- ALWAYS ask open questions before closed
- MAX 3 messages per state

Max length: 30 words.
Tone: Warm, curious, patient.

Output format:
{
  "response": "string",
  "strategy_used": "enum",
  "slots_filled": { "primary_goal": "string?", "motivation_reasons": ["string"] },
  "next_state": "goal_discovery | history_barriers | null"
}
```

### C. Recovery: Missed Session

```
You are the Recovery Specialist for Bloom-for-Learning. You are in RECOVERY mode.

Context:
- User missed session: {topic} scheduled at {time}
- User's barrier history: {barriers}
- User's confidence score: {confidence}
- Recovery stage: {stage}
- Week miss count: {miss_count}

Your task:
Send a brief, nonjudgmental message appropriate to the current recovery stage.

Stage guidance:
- INITIATE: Acknowledge miss, invite sharing
- EXPLORE: Reflect, normalize, explore barrier
- RESOLVE: Offer choices for forward action
- COMPLETE: Confirm change, affirm resilience

Allowed strategies: reflection, normalization, barrier_exploration, choice_framing, affirmation, reframe_partial_progress
Forbidden: guilt, shame, advice_before_understanding, absolutist_claims

Invariants:
- NEVER use guilt, shame, or comparison language
- ALWAYS assume legitimate reason for miss
- ALWAYS end with forward-looking action
- MAX 1 recovery message per missed session

Max length: 40 words.

Output format:
{
  "response": "string",
  "strategy_used": "enum",
  "recovery_stage": "initiate | explore | resolve | complete",
  "plan_adjustment": { "type": "string", "details": {} } | null,
  "escalation_needed": false
}
```

### D. Planning: Collaborative Plan Draft

```
You are the Planning Specialist for Bloom-for-Learning. You are in PLANNING mode.

Context:
- User profile: {profile_summary}
- Draft plan: {draft_plan}
- Current week constraints: {calendar_busy_times}
- Planning stage: {stage}

Your task:
Present the draft plan as a starting point, not a prescription. Ask what feels right or off.
Offer specific choices based on their barriers and preferences.

Allowed strategies: choice_framing, collaborative_planning, reflection, confidence_scaling, barrier_exploration, summary
Forbidden: commanding language, ignoring user constraints, overloading the week, single_option

Invariants:
- NEVER impose a plan without user agreement
- ALWAYS offer choices, never single options
- ALWAYS respect weekly_time_budget from profile
- NEVER schedule during blocked times

Max length: 80 words.

Output format:
{
  "response": "string",
  "strategy_used": "enum",
  "proposed_plan": "WeeklyPlan",
  "calendar_events": ["CalendarEvent"],
  "confirmation_needed": true,
  "modifications_made": ["string"]
}
```

---

## 19. A2A External Interface (New)

### 19.1 Purpose

Everything above (§6-§10) is internal orchestration — how Bloom builds a coaching response once it decides to. This section defines the boundary where Bloom becomes discoverable and delegable **to genuinely external agents** — other systems, built by other teams, that don't share Bloom's code or state, and shouldn't need to. This is the actual A2A protocol: Agent Card discovery, Task/Artifact lifecycle, JSON-RPC transport.

We expose exactly three skills at MVP — narrow on purpose (§17). Content tutoring, which v1.0 explicitly deferred as scope creep, is the clearest future candidate for the *other* direction: Bloom delegating out to an external tutoring agent via A2A instead of building tutoring in-house.

### 19.2 Agent Card

Published at `https://bloom-for-learning.app/.well-known/agent.json`. Per A2A v1.0, this card is signed so callers can verify it was actually issued by `bloom-for-learning.app` and not a spoofed endpoint.

```json
{
  "name": "bloom-coaching-agent",
  "description": "Facilitative self-learning coach: weekly planning, recovery support, and structured reflection for self-directed learners.",
  "version": "1.1.0",
  "url": "https://bloom-for-learning.app/a2a",
  "provider": {
    "organization": "Bloom-for-Learning",
    "url": "https://bloom-for-learning.app"
  },
  "capabilities": {
    "streaming": false,
    "pushNotifications": true,
    "stateTransitionHistory": true
  },
  "securitySchemes": {
    "oauth2": {
      "type": "oauth2",
      "scopes": {
        "coach.plan": "Request a weekly plan on behalf of an authenticated user",
        "coach.recovery": "Request recovery coaching for a missed session",
        "coach.reflect": "Trigger a reflection prompt"
      }
    }
  },
  "skills": [
    {
      "id": "plan_week",
      "name": "Weekly Plan Creation",
      "description": "Collaboratively draft or adjust a learner's weekly study plan, respecting their time budget and known barriers.",
      "inputModes": ["text", "data"],
      "outputModes": ["data"],
      "requiredScopes": ["coach.plan"]
    },
    {
      "id": "recovery_coaching",
      "name": "Missed Session Recovery",
      "description": "Provide a single nonjudgmental recovery interaction after a learner misses a planned session.",
      "inputModes": ["text", "data"],
      "outputModes": ["text", "data"],
      "requiredScopes": ["coach.recovery"]
    },
    {
      "id": "reflect_session",
      "name": "Structured Reflection Prompt",
      "description": "Generate a context-appropriate reflection prompt (post-session, end-of-week, or post-recovery).",
      "inputModes": ["data"],
      "outputModes": ["text"],
      "requiredScopes": ["coach.reflect"]
    }
  ]
}
```

### 19.3 Task Lifecycle

A2A models each request as a Task moving through defined states. Bloom's A2A interface is a thin adapter over the existing Coordinator — every task ultimately becomes one Coordinator delegation (§6), so external callers get the same safety guarantees as in-app users, never a shortcut around them.

```
submitted → working → [input-required] → completed
                    └─────────────────→ failed
```

| State | Meaning | Internal mapping |
|---|---|---|
| `submitted` | Task received, auth validated, skill recognized | A2ATask row created (§12.1) |
| `working` | Coordinator has delegated to the relevant specialist | AgentDelegation row created (§12.1), linked to A2ATask |
| `input-required` | Specialist needs clarification the external caller must supply (e.g., ambiguous plan constraints) | Coordinator returns a partial Artifact requesting more input; task stays open |
| `completed` | Specialist responded, safety filter passed | Final Artifact attached to A2ATask |
| `failed` | Timeout, safety filter rejection with no safe fallback, or invalid input | Error detail attached, task closed |

### 19.4 Example: External `plan_week` Request

**Request (external agent → Bloom):**
```json
{
  "jsonrpc": "2.0",
  "method": "tasks/send",
  "params": {
    "id": "task-uuid",
    "message": {
      "role": "user",
      "parts": [
        {
          "type": "data",
          "data": {
            "skill_id": "plan_week",
            "user_id": "bloom-user-uuid",
            "context": "Learner has a certification exam in 6 weeks, prefers evening sessions"
          }
        }
      ]
    }
  }
}
```

**Bloom's internal handling:**
1. Validate OAuth token has `coach.plan` scope for this `user_id`
2. Create `A2ATask` (state: `submitted`)
3. Coordinator opens an internal session, delegates to Planning Agent exactly as in §9.1 — same invariants, same safety filter, same prompt template (§18.D)
4. `A2ATask` transitions to `working`, then `completed`

**Response (Bloom → external agent):**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "id": "task-uuid",
    "state": "completed",
    "artifact": {
      "name": "weekly_plan",
      "parts": [
        {
          "type": "data",
          "data": {
            "plan_id": "plan-uuid",
            "weekly_goal": "3 practice sessions before exam week",
            "sessions": [
              { "scheduled_at": "2026-07-06T19:00:00-03:00", "duration_minutes": 45, "topic": "Practice set 1" },
              { "scheduled_at": "2026-07-08T19:00:00-03:00", "duration_minutes": 45, "topic": "Practice set 2" }
            ],
            "confirmation_needed": true
          }
        }
      ]
    }
  }
}
```

Note `confirmation_needed: true` — the Planning Agent's core invariant (§8.3: never impose a plan without agreement) holds even for A2A callers. The external agent is responsible for surfacing that confirmation step to its own user before treating the plan as final.

### 19.5 What A2A Callers Never See

Same boundary as MCP (§11.4), enforced by routing every A2A task through the Coordinator:
- Internal agent names, prompts, or the §6.3 envelope
- Raw conversation history
- Any specialist output that hasn't passed the safety filter
- Other users' data (scope is single-user, token-bound)

### 19.6 Acceptance Criteria
- [ ] Agent Card is signed and resolves at the well-known URL
- [ ] All three skills reachable end-to-end via a JSON-RPC test client
- [ ] Every completed A2A task has a corresponding `AgentDelegation` record showing it went through the same Coordinator + safety gate as in-app traffic
- [ ] Unauthorized or malformed task requests are rejected before reaching the Coordinator (100%, per §14.5)
- [ ] `input-required` state correctly pauses a task without invoking a second specialist (respects §6.4's max-1-delegation rule)

---

*End of MVP Specification v1.1*
