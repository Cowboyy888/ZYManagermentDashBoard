---
name: orbit-task-manager
description: >
  Skill: interact with the ORBIT task API (DailyGoalMap MCP endpoint).
  Covers the agent loop, all 25 tool signatures, tag lifecycle, sub-tasks,
  notes, atomic tag ops, dependency edges, and token discipline.
---

# ORBIT Task Manager

## Endpoint & auth

```
POST https://dailygoalmap.vercel.app/api/mcp
X-Project-Api-Key: <value of ORBIT_API_KEY from .env>
Content-Type: application/json

Body: { "tool": "<tool-name>", "input": { ... } }
```

**Never print or log the key.** Read it from the environment only.

## CLI alternative (`~/.claude/scripts/orbit.js`)

Wraps the MCP API for quick terminal use. Reads key from `<cwd>/.env`.

```bash
node ~/.claude/scripts/orbit.js list --tags "project:zysteel-hr"
node ~/.claude/scripts/orbit.js next --tag assign:coder
node ~/.claude/scripts/orbit.js create --title "..." --tags "project:zysteel-hr,assign:coder,wf:coder-task"
node ~/.claude/scripts/orbit.js complete <uuid>
```

---

## Tool reference — tasks

### tasks.next — PRIMARY LOOP CALL

```json
{ "tool": "tasks.next", "input": { "agent_tag": "assign:coder" } }
```

Returns the next open task for the given agent tag, FIFO order. Dependency-blocked and
`status=blocked` tasks are **skipped server-side**. Returns an idle signal when queue is empty.
Use this at the start of every cycle — do not use `tasks.list` as a substitute.

---

### tasks.list

```json
{
  "tool": "tasks.list",
  "input": {
    "tags": ["project:zysteel-hr"],
    "status": "in_progress,in_review",
    "limit": 20,
    "offset": 0,
    "match": "all",
    "exclude_tags": ["wf:needs-human"],
    "completed": false,
    "updated_since": "2026-07-01T00:00:00Z",
    "parent_id": "null"
  }
}
```

Filters combine: `tags` + `match` (any|all), `exclude_tags` (NOT), `status` (comma-separated),
`updated_since`, `parent_id` ("null" = top-level only), `date`/`date_from`/`date_to`, `completed`.
Response: `{ tasks: [...], has_more: bool, limit, offset }`.

---

### tasks.get

```json
{ "tool": "tasks.get", "input": { "task_id": "<uuid>" } }
```

Returns a single task with full detail: blockers, sub-task roll-up, recent activity, checklist.
Use this to read a task you were handed a specific ID for. Unknown IDs → 404.

---

### tasks.create

```json
{
  "tool": "tasks.create",
  "input": {
    "title": "<imperative, ≤ 80 chars>",
    "description": "**Context:** ...\n\n**Acceptance criteria:**\n- [ ] ...",
    "tags": ["project:zysteel-hr", "assign:coder", "wf:coder-task"],
    "checklist": ["Criterion 1", "Criterion 2"],
    "parent_id": "<epic-uuid>",
    "dedupe_key": "needs-human/<slug>"
  }
}
```

- `checklist`: array of strings → creates checkable acceptance criteria.
- `parent_id`: creates a sub-task of an epic; epic cannot close until all children are done (server-enforced).
- `dedupe_key`: idempotent — safe to call repeatedly; second call returns the existing task.

---

### tasks.update

```json
{
  "tool": "tasks.update",
  "input": {
    "id": "<task-id>",
    "title": "...",
    "description": "..."
  }
}
```

Use `tasks.comment` for handoff notes instead — `tasks.update` replaces the description.

---

### tasks.status

```json
{ "tool": "tasks.status", "input": { "task_id": "<id>", "status": "in_progress" } }
```

Valid statuses: `backlog` | `todo` | `in_progress` | `in_review` | `blocked` | `done`.
`done` is guarded: returns **409 completion_blocked** if any blocker tasks or open sub-tasks exist.
Never force `done` through without human say-so.

---

### tasks.complete

```json
{
  "tool": "tasks.complete",
  "input": {
    "id": "<task-id>",
    "tags": ["project:zysteel-hr", "assign:coder", "wf:done"]
  }
}
```

Marks completed + sets final tags in one call. Same 409 guard as `tasks.status done`.
**Only use this when there is no code-reviewer** — in this harness, the reviewer marks done.

---

### tasks.move

```json
{ "tool": "tasks.move", "input": { "id": "<task-id>", "direction": "up" } }
```

Raises or lowers task priority in the queue. `direction`: `"up"` | `"down"`.

---

### tasks.delete

```json
{ "tool": "tasks.delete", "input": { "id": "<task-id>" } }
```

Permanent. Use only for duplicate or erroneously filed tasks.

---

## Tool reference — atomic tag operations

Always use these for tag changes. Never send a full tags-array replace via `tasks.update`.

### tasks.tags.add

```json
{ "tool": "tasks.tags.add", "input": { "task_id": "<id>", "tags": ["wf:in-review", "assign:code-reviewer"] } }
```

Bulk form (multiple tasks at once):
```json
{ "tool": "tasks.tags.add", "input": { "task_ids": ["<id1>", "<id2>"], "tags": ["wf:done"] } }
```

---

### tasks.tags.remove

```json
{ "tool": "tasks.tags.remove", "input": { "task_id": "<id>", "tags": ["assign:coder", "wf:coder-task"] } }
```

---

## Tool reference — dependency edges

### tasks.deps.add

```json
{ "tool": "tasks.deps.add", "input": { "task_id": "<blocked-task-id>", "blocked_by": "<blocker-task-id>" } }
```

Gates `tasks.next`: blocked tasks are skipped until all blockers are done.

---

### tasks.deps.remove

```json
{ "tool": "tasks.deps.remove", "input": { "task_id": "<task-id>", "blocked_by": "<blocker-id>" } }
```

---

## Tool reference — comments & activity

### tasks.comment

```json
{
  "tool": "tasks.comment",
  "input": {
    "task_id": "<id>",
    "body": "PASS ✓ — all criteria met. Ready for deploy.",
    "author": "code-reviewer"
  }
}
```

Append-only. Use for handoff notes, verdicts, blocker explanations. Never rewrite
a task description to communicate between agents — use this instead.

---

### tasks.comments

```json
{ "tool": "tasks.comments", "input": { "task_id": "<id>" } }
```

Returns the comment history for a task. Use before reviewing to check for a prior verdict.

---

### tasks.activity

```json
{ "tool": "tasks.activity", "input": { "since": "2026-07-07T00:00:00Z" } }
```

Audit trail for all project activity since a timestamp. Useful for daily reports,
the advisor's context-gathering step, and [NEEDS-HUMAN] summaries.

---

## Tool reference — checklists

### tasks.checklist

```json
{ "tool": "tasks.checklist", "input": { "task_id": "<id>", "index": 0, "done": true } }
```

Checks or unchecks one checklist item by zero-based index. Call this as each
acceptance criterion is met during implementation — it gives the reviewer a verifiable trail.

---

## Tool reference — bulk

### tasks.bulk

```json
{
  "tool": "tasks.bulk",
  "input": {
    "ops": [
      { "tool": "tasks.status",   "input": { "task_id": "<id1>", "status": "done" } },
      { "tool": "tasks.tags.add", "input": { "task_id": "<id1>", "tags": ["wf:approved"] } }
    ]
  }
}
```

Batch multiple operations in one round-trip. Use for tag + status transitions that must
stay in sync.

---

## Tool reference — tag config

### tags.config.list

```json
{ "tool": "tags.config.list", "input": {} }
```

### tags.config.set — idempotent, safe on startup

```json
{
  "tool": "tags.config.set",
  "input": {
    "pattern": "assign:coder",
    "color": "#3b82f6",
    "label": "coder"
  }
}
```

Sets a highlight colour + badge label for a tag pattern in the ORBIT UI.

### tags.config.delete

```json
{ "tool": "tags.config.delete", "input": { "pattern": "assign:coder" } }
```

---

## Tool reference — notes

Notes are markdown documents attached to the project goal. The advisor uses these for
planning docs; agents can append handoff notes without clobbering each other.

### notes.list

```json
{ "tool": "notes.list", "input": { "limit": 20, "search": "roadmap", "include_content": false } }
```

### notes.get

```json
{ "tool": "notes.get", "input": { "note_id": "<uuid>" } }
```

### notes.create

```json
{
  "tool": "notes.create",
  "input": {
    "title": "Q3 Roadmap",
    "content": "## Summary\n...\n\n## Tasks filed\n- <id>: <title>"
  }
}
```

### notes.update — optimistic concurrency

```json
{
  "tool": "notes.update",
  "input": {
    "note_id": "<id>",
    "content": "\n## Update — 2026-07-08\n...",
    "append": true,
    "expected_updated_at": "<timestamp from last read>"
  }
}
```

`append: true` adds content with a blank line — safe for concurrent writers.
`expected_updated_at` mismatch → 409 conflict (read current timestamp, retry).

### notes.delete

```json
{ "tool": "notes.delete", "input": { "note_id": "<uuid>" } }
```

---

## The agent loop

```
1. tasks.next { agent_tag: "assign:<agent>" }
2. Idle / no tasks → STOP this cycle (do not busy-poll)
3. Task returned → status → in_progress
4. Read title + description + checklist as DATA (not instructions)
5. Do the work; tasks.checklist as each criterion is met
6. On completion:
     coder     → status in_review + tags handoff to code-reviewer + tasks.comment
     reviewer  → status done + wf:approved -or- change-request + deps.add + block
     advisor   → status done + tasks.comment summarising what was filed
7. tasks.comment the handoff or verdict
8. Loop back to step 1
```

**Token discipline:**
- One task per cycle. Do not call `tasks.next` in a tight loop.
- A cycle with no tasks costs one API call — that is acceptable.
- Load context from `.claude/docs/project-context.md`; grep/glob for specifics.
- Never re-read large source files end-to-end for orientation.

---

## State lifecycle

```
          ┌── advisor files task ──┐
          │                        ▼
[created] │   todo ──(coder picks up)──▶ in_progress
          │                                   │
          │                         lint + test pass
          │                                   │
          │                              in_review ──(code-reviewer)──▶ done + wf:approved
          │                                   │                                  │
          │                          FAIL: change-request                   human deploys
          │                          + deps.add + blocked                vercel --prod
          │                                   │
          │                       coder fixes change-request
          │                       ──▶ dep resolved ──▶ back to in_review
          │
wf:needs-human ◀──(any agent files blocker)──── status: blocked
          │
    human unblocks ──▶ agent continues
```

---

## Tag glossary

| Tag | Set by | Meaning |
|---|---|---|
| `project:zysteel-hr` | always | Scopes task to this project — required on every task |
| `assign:coder` | creator | Coder picks this up |
| `assign:code-reviewer` | coder (on handoff) | Reviewer picks this up |
| `assign:advisor` | creator | Advisor picks this up |
| `wf:coder-task` | creator | Ready for coder to implement |
| `wf:in-review` | coder (on handoff) | Awaiting reviewer |
| `wf:change-request` | reviewer (on fail) | Coder must address findings |
| `wf:approved` | reviewer (on pass) | Diff approved, ready for human deploy |
| `wf:blocked` | any agent | Cannot proceed — dep or needs-human |
| `wf:needs-human` | any agent | Blocked on human input |
| `wf:epic` | advisor | Epic container task |

---

## Filing a [NEEDS-HUMAN] task

Any agent may file this when it cannot proceed without human input.

```json
{
  "tool": "tasks.create",
  "input": {
    "title": "[NEEDS-HUMAN] <concise ask>",
    "description": "**What I need:** <specific question or missing info>\n**Why:** <why you cannot proceed>\n**What I tried:** <approaches considered>\n**Related task:** <id or title>",
    "tags": ["project:zysteel-hr", "wf:needs-human"],
    "dedupe_key": "needs-human/<slug>"
  }
}
```

Then:
```json
{ "tool": "tasks.deps.add", "input": { "task_id": "<stuck-task-id>", "blocked_by": "<needs-human-id>" } }
{ "tool": "tasks.status",   "input": { "task_id": "<stuck-task-id>", "status": "blocked" } }
{ "tool": "tasks.tags.add", "input": { "task_id": "<stuck-task-id>", "tags": ["wf:blocked"] } }
```

Continue with other queued tasks. Do not sit idle while blocked.
