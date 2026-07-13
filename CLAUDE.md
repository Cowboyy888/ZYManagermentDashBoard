# ZY Steel HR Dashboard — Claude Code Guide

Next.js 15 HR dashboard for a steel manufacturing company. TypeScript, Prisma v6,
PostgreSQL, Vercel Blob private storage, Better Auth, deployed on Vercel.

## Quick reference

| Action | Command |
|---|---|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Tests | `npm run test` |
| Prisma generate | `npm run postinstall` |
| DB migration | `npm run db:migrate` |
| Deploy | `vercel --prod` (**human only**) |

## Source layout

```
src/
  app/(dash)/      Dashboard pages (protected)
  app/(auth)/      Login
  app/api/         Route handlers
  actions/         Server actions (one file per domain)
  components/      Shared UI components
  lib/             Auth, DB client, RBAC, utilities
prisma/
  schema.prisma    Canonical data model
```

Path alias: `@/*` → `src/*`

## Coding conventions

- **No comments** unless the WHY is non-obvious. No docstrings. No task-reference comments.
- Section dividers: `// ── Name ────────────────────────────────────────────`
- UI: inline `React.CSSProperties` — no Tailwind, no CSS modules
- Client components end in `Client.tsx`
- Auth in route handlers: `auth.api.getSession({ headers: req.headers })`
- TypeScript: strict is off — still write correct types

## Security

- Never commit: `.env*`, `public/`, `prisma/fix-login.ts`, `prisma/production-migration.sql`
- Never print API keys or tokens
- `prisma db push --accept-data-loss` → requires explicit confirmation
- Employee photos → always require authentication

---

## Multi-Agent Workflow (ORBIT)

This repo is wired to the DailyGoalMap ORBIT task API for structured agent-driven
development. Three agents; only **coder** edits source.

### Agents

| Agent | Edits source? | Role |
|---|---|---|
| **coder** | YES (only one) | Implements tasks; hands off to code-reviewer |
| **code-reviewer** | NO | Reviews diff; PASS → approved, FAIL → change-request |
| **advisor** | NO | Prioritizes backlog; files specced tasks for coder |

### Workflow docs

| File | Purpose |
|---|---|
| [`.claude/docs/workflow.md`](.claude/docs/workflow.md) | Full state machine, 3-agent flow, tag lifecycle |
| [`.claude/docs/project-context.md`](.claude/docs/project-context.md) | Canonical stack/layout reference for agents |
| [`.claude/docs/orbit-api-notes.md`](.claude/docs/orbit-api-notes.md) | All 25 ORBIT MCP tool signatures and examples |
| [`.claude/skills/orbit-task-manager.md`](.claude/skills/orbit-task-manager.md) | Agent loop spec, full tool reference, tag glossary |
| [`.claude/agents/coder.md`](.claude/agents/coder.md) | Coder agent rules and constraints |
| [`.claude/agents/code-reviewer.md`](.claude/agents/code-reviewer.md) | Reviewer agent rules and verdict protocol |
| [`.claude/agents/advisor.md`](.claude/agents/advisor.md) | Advisor agent rules and task-filing spec |

### Commands

```
/implement [task-id]         Pull next (or specific) coder task and implement it
/review-before-pr [task-id]  Run code-reviewer on a completed task
/sync-agent-task             Queue a new task for the coder
```

### Tag convention

```
project:zysteel-hr      — required on every task
assign:coder            — coder's queue
assign:code-reviewer    — reviewer's queue (set by coder on handoff)
assign:advisor          — advisor's queue
wf:coder-task           — ready to implement
wf:in-review            — awaiting code-reviewer
wf:change-request       — reviewer found issues; coder must fix
wf:approved             — reviewer passed; ready for human deploy
wf:blocked              — dependency or needs-human
wf:needs-human          — blocked on human input
```

### Key rule

The coder never pushes or deploys. After `wf:approved`:
1. Human reviews the diff
2. Human runs `vercel --prod`
