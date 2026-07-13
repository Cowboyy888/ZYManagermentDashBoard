---
name: review-before-pr
description: >
  Run the code-reviewer agent on a completed coder task. Inspects the diff,
  checks acceptance criteria and conventions, and either marks the task
  wf:approved or files a change-request that blocks it and routes back to coder.
---

# /review-before-pr [task-id]

Runs one code-review cycle for a completed coder task.

## Usage

```
/review-before-pr <orbit-task-id>   # review a specific task
/review-before-pr                   # pull next task tagged assign:code-reviewer
```

## What happens

1. **Fetch task**
   - If `<task-id>` provided: `tasks.get { task_id }` → retrieves task + blockers + checklist.
   - Otherwise: `tasks.next { "agent_tag": "assign:code-reviewer" }`.
   - Queue empty or task not found → report idle, stop.

2. **Guard: check for prior review**
   ```json
   { "tool": "tasks.comments", "input": { "task_id": "<id>" } }
   ```
   If a PASS or FAIL comment from `code-reviewer` exists → already reviewed, stop.

3. **Set status in_progress**
   ```json
   { "tool": "tasks.status", "input": { "task_id": "<id>", "status": "in_progress" } }
   ```

4. **Inspect the diff**
   - Use `git log --oneline main..HEAD` to find commits.
   - `git diff main...HEAD -- <files named in task>` to read changes.
   - Read only the files the task touches — do not slurp all of `src/`.

5. **Apply the reviewer checklist** from `.claude/agents/code-reviewer.md`.

6. **Render verdict**

   **PASS**:
   ```json
   { "tool": "tasks.status",     "input": { "task_id": "<id>", "status": "done" } }
   { "tool": "tasks.tags.add",   "input": { "task_id": "<id>", "tags": ["wf:approved"] } }
   { "tool": "tasks.tags.remove","input": { "task_id": "<id>", "tags": ["assign:code-reviewer","wf:in-review"] } }
   { "tool": "tasks.comment",    "input": { "task_id": "<id>", "body": "PASS ✓ — <summary>", "author": "code-reviewer" } }
   ```

   **FAIL** — create change-request + block original:
   ```json
   { "tool": "tasks.create",     "input": { "title": "Change request: <title>", "description": "**Findings:**\n1. ...", "tags": ["project:zysteel-hr","assign:coder","wf:change-request"], "dedupe_key": "change-request/<original-id>" } }
   { "tool": "tasks.deps.add",   "input": { "task_id": "<original-id>", "blocked_by": "<change-request-id>" } }
   { "tool": "tasks.status",     "input": { "task_id": "<original-id>", "status": "blocked" } }
   { "tool": "tasks.tags.add",   "input": { "task_id": "<original-id>", "tags": ["wf:blocked"] } }
   { "tool": "tasks.tags.remove","input": { "task_id": "<original-id>", "tags": ["wf:in-review","assign:code-reviewer"] } }
   { "tool": "tasks.comment",    "input": { "task_id": "<original-id>", "body": "FAIL — change-request: <change-request-id>", "author": "code-reviewer" } }
   ```

7. **Report** to the human: verdict, files checked, findings (if any).
   Do NOT push or deploy.

## Blockers

Cannot render verdict? File a [NEEDS-HUMAN] task (see `orbit-task-manager.md`) and stop.
