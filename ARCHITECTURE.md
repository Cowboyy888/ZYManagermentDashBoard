# ZY Steel HR Dashboard — Architecture

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router (RSC + Server Actions) |
| Auth | Better Auth 1.1 |
| Database | PostgreSQL (Neon) via Prisma 6 |
| UI | React 19, inline CSS variables, ~5% Tailwind |
| Charts | Recharts |
| Tables | TanStack React Table v8 |
| Validation | Zod (server-side only) |
| Testing | Vitest 2 |

---

## Route Groups

```
app/
  (auth)/         Login pages (no sidebar)
  (dash)/         Authenticated dashboard (sidebar + top bar)
  (print)/        Print-only views (no chrome)
  (tv)/           Fullscreen factory TV dashboard
  api/
    auth/         Better Auth handler
    cron/         Scheduled jobs (authenticated via x-cron-secret)
    ai/           AI assistant proxy
    upload/       Photo/document upload
```

---

## Authentication & Authorization

**Session guard** — every server action and RSC data-fetch calls `requireUser()` (redirects to `/login`) or `guard(action)` (throws `UNAUTHORIZED`).

**RBAC** — 6 roles (`OWNER`, `HR_MANAGER`, `SUPERVISOR`, `OPERATOR`, `VIEWER`, `PORTAL`), 29 guarded actions defined in `src/lib/rbac.ts`. Permission check: `can(user.role, action)`.

**Middleware** (`src/middleware.ts`) — fast cookie-presence check on every request. Public paths: `/api/auth/**`, `/api/cron/**`, `/login`, `/portal/login`, `/portal/register`. Cron routes authenticate via `x-cron-secret` header in the handler; middleware passes them through without a session check.

---

## Data Layer

**No migration workflow** — schema changes use `prisma db push`. After any schema change run `prisma generate`.

**ActionResult pattern** — all server actions return:
```ts
type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }
```
Use `"error" in res` (not `!res.ok`) for TypeScript narrowing in async callbacks inside `startTransition`.

**Helpers** from `src/lib/utils/action.ts`:
- `ok(data)` — success wrapper
- `err(e)` — error wrapper with Prisma error sanitization (unique/FK/not-found → human messages; no stack traces to client)
- `parsePagination(params)` — clamps page ≥ 1, pageSize 1–100
- `paginated(data, total, page, pageSize)` — standard paginated response
- `bigintToNumber(id)` — safe BigInt → number for Prisma BigInt ids

---

## Design System (`src/components/ui/`)

All components are barrel-exported from `src/components/ui/index.ts`.

| Component | Purpose |
|---|---|
| `Button` | Primary/secondary/danger/ghost/outline; xs–lg sizes; `loading` spinner |
| `Badge` | Color-coded labels; `statusColor(status)` auto-maps status strings |
| `Card` / `KpiCard` | Surface containers; metric tiles |
| `PageHeader` | Title + subtitle + breadcrumbs + action slot |
| `Alert` / `FieldError` | info/success/warning/error banners; field validation |
| `Input` / `Select` / `Textarea` | Labelled form controls with error display |
| `Dialog` / `ConfirmDialog` | Modal with escape + backdrop close, body scroll lock |
| `Spinner` / `PageLoader` / `Skeleton` | Loading states |
| `DataTable` | TanStack Table wrapper — searchable, sortable, paginated |
| `Pagination` | Page list with ellipsis + page-size selector |
| `Toast` / `ToastProvider` / `useToast` | Context-based notifications; auto-dismiss 4s/6s |

`ToastProvider` wraps `<main>` in `(dash)/layout.tsx`. Use `useToast()` in any client component within the dashboard.

---

## Shared Utilities (`src/lib/utils/`)

**`format.ts`** — pure formatting functions (safe for server + client):
`fmtUsd`, `fmtKhr`, `fmtNumber`, `fmtPercent`, `fmtWeight`, `fmtDate`, `fmtDateTime`, `fmtTime`, `fmtRelative`, `fmtDuration`, `fmtEmployeeName`, `fmtInitials`, `fmtFileSize`, `fmtStatus`

Import from `@/lib/utils` (barrel). Never define inline date/currency formatters; use these instead.

---

## Smart Factory (Phase 1)

IoT integration is stubbed — Phase 1 ships UI and data model without live PLC connections.

**Routes** under `(dash)/factory/`:
- `/factory` — digital twin overview map
- `/factory/machines` — machine grid with status filter
- `/factory/machines/[id]` — machine detail, OEE, alarms, runtime logs
- `/factory/alarms` — alarm center with acknowledge/resolve workflow
- `/factory/oee` — fleet OEE gauges + daily trend
- `/factory/shifts` — shift summaries + 14-day trend
- `/factory/iot` — IoT device registry

**TV dashboard** at `/factory/tv` (route group `(tv)/factory/tv/`) — fullscreen dark display, 10s auto-refresh.

**OEE formula**: `Availability = (PlannedTime − Downtime) / PlannedTime × 100`; `OEE = A × P × Q / 10000`

---

## Security

- All private env vars (`DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`, etc.) are server-only.
- Only `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_AUTH_URL` are exposed to the client.
- Security headers set in `next.config.mjs`: HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy.
- `poweredByHeader: false` — no `X-Powered-By: Next.js` leakage.
- Employee photos under `/uploads/` are authenticated-only (middleware does NOT exclude this path).

---

## Environment Variables

See `.env.example` for the full list. Required to start:

```
DATABASE_URL     PostgreSQL connection string
AUTH_SECRET      32-byte random secret (openssl rand -base64 32)
AUTH_URL         Canonical base URL (no trailing slash)
CRON_SECRET      64-char hex secret for cron jobs
```

Optional: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ANTHROPIC_API_KEY`, Cloudflare R2 vars, `TURNSTILE_SECRET_KEY`.
