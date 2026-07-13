# Workflow — ZY Steel HR Dashboard

## Agent roster

| Agent | Edits source? | ORBIT tag | Role |
|---|---|---|---|
| **coder** | YES (only one) | `assign:coder` | Implement tasks end-to-end |
| **code-reviewer** | NO | `assign:code-reviewer` | Diff review; PASS → done, FAIL → change-request |
| **advisor** | NO | `assign:advisor` | Prioritize backlog; file specced tasks for coder |

## State machine

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                         ORBIT Task Lifecycle                                │
 │                                                                             │
 │  advisor / human creates task                                               │
 │  tags: project:zysteel-hr, assign:coder, wf:coder-task  (status: todo)    │
 │                          │                                                  │
 │                          ▼                                                  │
 │               coder: tasks.status in_progress                               │
 │               tasks.checklist as each criterion is met                      │
 │               npm run lint + npm run test                                   │
 │                          │                                                  │
 │                          ▼                                                  │
 │               coder: tasks.status in_review                                 │
 │               tags.add assign:code-reviewer wf:in-review                   │
 │               tags.remove assign:coder wf:coder-task                       │
 │               tasks.comment "Submitted for review"                          │
 │                          │                                                  │
 │                          ▼                                                  │
 │               code-reviewer reads diff & checklist                          │
 │                     │               │                                       │
 │               PASS  │               │  FAIL                                 │
 │                     ▼               ▼                                       │
 │          status: done       tasks.create change-request task                │
 │          tag: wf:approved   tasks.deps.add (original blocked_by CR)         │
 │                │            status: blocked, tag: wf:blocked                │
 │                │                        │                                   │
 │                │             coder picks up change-request                  │
 │                │             fixes findings                                 │
 │                │             CR → done (dep edge removed)                   │
 │                │             original unblocks → re-submit for review       │
 │                ▼                                                            │
 │          Human reviews diff via ORBIT UI                                    │
 │          Human runs: vercel --prod                                           │
 │                                                                             │
 │  Any agent blocked → wf:needs-human task filed (dedupe_key'd)               │
 │  tasks.deps.add (stuck blocked_by needs-human)                              │
 │  Human unblocks → agent continues other work in meantime                   │
 └─────────────────────────────────────────────────────────────────────────────┘
```

## How a task flows through the system

### 1. Task creation (human or advisor)

Tasks enter the queue with these tags:

```
project:zysteel-hr   assign:coder   wf:coder-task
```

Created via `/sync-agent-task` or directly in the ORBIT UI, or by the advisor agent
running `/implement` with its own advisory task queued.

### 2. Coder picks up

```
tasks.next { "agent_tag": "assign:coder" }
→ tasks.status in_progress
→ implement + tasks.checklist as criteria met
→ npm run lint + npm run test
→ tasks.status in_review
→ tasks.tags.add  assign:code-reviewer wf:in-review
→ tasks.tags.remove assign:coder wf:coder-task
→ tasks.comment "Submitted for review — <summary of what changed>"
```

### 3. Reviewer evaluates

```
tasks.next { "agent_tag": "assign:code-reviewer" }
→ tasks.comments (guard: skip if already reviewed)
→ tasks.status in_progress
→ git diff + grep/glob files named in task
→ apply reviewer checklist (agents/code-reviewer.md)
```

**PASS:**
```
tasks.status done
tasks.tags.add wf:approved
tasks.tags.remove assign:code-reviewer wf:in-review
tasks.comment "PASS ✓ — <summary>"
```

**FAIL:**
```
tasks.create change-request (dedupe_key "change-request/<original-id>")
tasks.deps.add original blocked_by change-request
tasks.status original → blocked
tasks.tags.add original → wf:blocked
tasks.comment original → "FAIL — <change-request-id>"
```

### 4. Human deploys

After `wf:approved`:

1. Human reviews diff in git or ORBIT UI
2. Human runs `vercel --prod` locally

The coder never pushes or deploys.

### 5. Advisor cycle

The advisor runs against its own queue (`assign:advisor`). It:
- Reads current backlog with `tasks.list + tasks.activity`
- Creates well-specced tasks for the coder (with checklists)
- Writes planning notes via `notes.create / notes.update`
- Does not assign human-named owners — only agent tags

## Tag reference

| Tag | Who sets it | Meaning |
|---|---|---|
| `project:zysteel-hr` | always | Required on every task |
| `assign:coder` | creator | Coder's queue |
| `assign:code-reviewer` | coder (handoff) | Reviewer's queue |
| `assign:advisor` | creator | Advisor's queue |
| `wf:coder-task` | creator | Ready for coder |
| `wf:in-review` | coder (handoff) | Awaiting review |
| `wf:change-request` | reviewer (fail) | Coder must fix |
| `wf:approved` | reviewer (pass) | Approved for deploy |
| `wf:blocked` | any agent | Dependency or needs-human |
| `wf:needs-human` | any agent | Human input required |
| `wf:epic` | advisor | Epic container (not assigned) |
| `wf:done` | coder (no-reviewer mode) | Complete — human to review/deploy |

## Commands

| Command | Who | When to use |
|---|---|---|
| `/implement [task-id]` | coder | Pull next (or specific) coder task and implement |
| `/review-before-pr [task-id]` | code-reviewer | Review completed task diff |
| `/sync-agent-task` | human | Queue a new task for the coder |

## Deploy

Deployment is always a **human action**:
```bash
vercel --prod
```
The coder never pushes or deploys. After `wf:approved` on a task:
1. Human reviews the diff
2. Human runs `vercel --prod`
