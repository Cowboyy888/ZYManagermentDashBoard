---
name: sync-agent-task
description: >
  Create or update an ORBIT task for the coder agent. Use this to hand off
  a specific piece of work into the queue without running the full implement loop.
---

# /sync-agent-task

Push a task into the ORBIT queue for the coder agent.

## Usage

```
/sync-agent-task
```

Claude will ask you for:
- **Title** — imperative, ≤ 80 chars (e.g. "Add contract-expiry badge to employee list")
- **Description** — acceptance criteria, affected files/routes (be specific)
- **Priority** — should this go to the top of the queue? (yes → `tasks.move` up after create)

## What happens

```json
{
  "tool": "tasks.create",
  "input": {
    "title": "<title>",
    "description": "<description with acceptance criteria>",
    "tags": ["project:zysteel-hr", "assign:coder", "wf:coder-task"]
  }
}
```

If priority = high, follow with:
```json
{ "tool": "tasks.move", "input": { "id": "<new-task-id>", "direction": "up" } }
```

Confirm the created task ID to the human.

---

**Note:** The advisor agent also creates tasks via this same `tasks.create` pattern.
Tasks it files include a `checklist` array of acceptance criteria and a precise
`description` that names the affected files and routes.
