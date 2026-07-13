# ZY Steel HR Dashboard — Project Context

This file is the canonical quick-reference for all agents. Read this first;
grep/glob for specifics. Do not re-derive these facts from the codebase each cycle.

## Identity

- **Package name**: `zysteel-hr` (v0.2.0)
- **ORBIT project tag**: `project:zysteel-hr`
- **Default branch**: `main`

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15.1 (App Router), React 19 |
| Language | TypeScript (strict: false) |
| Package manager | npm (lockfile v3, Node 26) |
| ORM / DB | Prisma v6 + PostgreSQL (Vercel Postgres) |
| Storage | Vercel Blob private store (`@vercel/blob`) |
| Auth | Better Auth v1.1 |
| Deploy | Vercel (`vercel --prod`) |

## Source layout

```
src/
  app/
    (auth)/          Login pages
    (dash)/          Main dashboard (protected)
    (portal)/        Customer/supplier portal
    (print)/         Print views
    (tv)/            Factory TV display
    api/             Route handlers (src/app/api/<slug>/route.ts)
  actions/           Server actions — one file per domain (employees.ts, payroll.ts …)
  components/        Shared UI — PascalCase (EmployeeTable.tsx, Sidebar.tsx …)
  lib/               Utilities, auth config, db client, RBAC
    auth/            config.ts (betterAuth config), session.ts (getSessionUser/requireUser)
    db.ts            Prisma client (edge-compatible)
    rbac.ts          Role-based access control
```

## Commands

| Purpose | Command |
|---|---|
| Dev server | `npm run dev` |
| Production build | `npm run build` |
| Lint | `npm run lint` |
| Tests | `npm run test` |
| Prisma generate | `npm run postinstall` |
| DB migration (dev) | `npm run db:migrate` |
| DB seed | `npm run db:seed` |
| Deploy | `vercel --prod` (**human only**) |

## Key patterns

### Auth in route handlers
```typescript
const session = await auth.api.getSession({ headers: req.headers });
if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
```

### Auth in server components / actions
```typescript
import { requireUser } from "@/lib/auth/session";
const user = await requireUser(); // redirects to /login if not authed
```

### Private blob serving
Employee photos are stored as private Vercel Blobs. They are served via
`/api/employee-photo` proxy which generates presigned URLs using
`issueSignedToken` + `presignUrl` from `@vercel/blob`. Clients reference
blobs through `resolvePhotoUrl()` defined in EmployeeProfileClient.tsx
and `resolvePreviewUrl()` in EmployeeForm.tsx.

### Middleware
`src/middleware.ts` — cookie-presence check for session. Routes that handle
auth internally (like `/api/employee-photo`) must be added to the
`pathname.startsWith(...)` exceptions block.

### UI style
Inline `React.CSSProperties` style objects throughout. No Tailwind, no CSS modules.
CSS variables defined in `src/app/globals.css` (e.g. `var(--steel)`, `var(--surface)`).

### Naming conventions
- Dirs: `kebab-case`
- React components: `PascalCase.tsx`, client components end in `Client.tsx`
- Server actions: `camelCase` functions in `src/actions/<domain>.ts`
- Route handlers: `src/app/api/<slug>/route.ts`

### Comment style
Section dividers only:
```typescript
// ── Section Name ────────────────────────────────────────────
```
No docstrings. No "what I did" or task-reference comments in code.

## Security constraints

- Never commit: `.env`, `.env.local`, `.env.*.local`, `public/`, `prisma/fix-login.ts`,
  `prisma/production-migration.sql`, `zysteel-hr-dashboard.html`
- Never print API keys or tokens to stdout
- `prisma db push --accept-data-loss` → requires explicit human confirmation
- Deleting production Vercel env vars → requires explicit human confirmation
- Employee photos → unauthenticated access must always be blocked

## ORBIT integration

- MCP endpoint: `https://dailygoalmap.vercel.app/api/mcp`
- Key env var: `ORBIT_API_KEY` (in `.env.local`, gitignored)
- See `.claude/skills/orbit-task-manager.md` for tool signatures and loop spec
