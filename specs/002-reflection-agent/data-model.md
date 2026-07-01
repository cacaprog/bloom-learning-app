# Data Model: Reflection Entry Schema

This document details the database schema, models, and validation rules for persisting user reflections.

---

## 1. Entity Definition: `ReflectionEntry`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| **`id`** | `UUID` | `PRIMARY KEY` | Unique identifier. |
| **`user_id`** | `UUID` | `FOREIGN KEY` (references `users.id`) | The user who logged the reflection. |
| **`trigger_type`** | `VARCHAR(32)` | `NOT NULL` | The trigger context: `session_completion`, `weekly_review`, `recovery_completion`. |
| **`prompt_text`** | `TEXT` | `NOT NULL` | The exact prompt presented to the user. |
| **`response_text`**| `TEXT` | `NULLABLE` | The user's input response. Null if skipped. |
| **`skipped`** | `BOOLEAN` | `DEFAULT FALSE` | True if the user bypassed the reflection screen. |
| **`created_at`** | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Log creation timestamp. |

---

## 2. SQL Schema Migration

```sql
CREATE TABLE reflection_entries (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    trigger_type VARCHAR(32) NOT NULL,
    prompt_text TEXT NOT NULL,
    response_text TEXT,
    skipped BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reflection_user_trigger ON reflection_entries(user_id, trigger_type);
```

---

## 3. Data Integrity & Validation Rules

1. **`response_text` size limit**: Truncated to a maximum of 500 characters to keep database records clean.
2. **Nullable on skip**: If `skipped` is `TRUE`, `response_text` MUST be set to `NULL`.
3. **Trigger validation**: Enforce that `trigger_type` matches one of the three allowed trigger string constants.
