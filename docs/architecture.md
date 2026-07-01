# ZYSTEEL HR — Architecture

**Status:** v0.1 · companion to `product.md` · 2026-06-30

This document records decisions, not just structure. The structure is mostly
convention and can change cheaply. The **decisions in §3 are the ones that are
expensive to reverse** — those got the real thought.

---

## 1. Stack (from brief, with rationale)

| Layer | Choice | Note |
|---|---|---|
| Framework | Next.js 15 App Router + TypeScript | Server Actions remove a separate API tier at this scale |
| UI | Tailwind + shadcn/ui + Framer Motion | shadcn = owned components, no runtime lock-in |
| Tables / charts | TanStack Table + Recharts | Table logic headless; Recharts is enough for our chart set |
| Data | Prisma → PostgreSQL | Prisma migrations give us a tracked schema history |
| Auth | Better Auth + RBAC | Session-based; four roles from product §2 |
| Host | Cloudflare Pages + R2 + Turnstile | **Edge runtime ⇒ driver constraint, see §3.4** |

---

## 2. Folder structure

```
zysteel-hr/
├─ docs/                      product.md, architecture.md, this file
├─ prisma/
│  ├─ schema.prisma           single source of truth for the data model
│  └─ seed.ts                 real June roster + departments + holidays + admin user
├─ src/
│  ├─ app/                    App Router
│  │  ├─ (auth)/login/        unauthenticated
│  │  ├─ (dash)/              authenticated shell: sidebar + topbar
│  │  │  ├─ page.tsx          Dashboard Home
│  │  │  ├─ employees/
│  │  │  ├─ attendance/
│  │  │  ├─ overtime/
│  │  │  ├─ payroll/
│  │  │  ├─ reports/
│  │  │  ├─ audit/
│  │  │  └─ settings/
│  │  └─ api/                 only where a webhook/file route is unavoidable
│  ├─ actions/                Server Actions, one file per domain (employees.ts, payroll.ts…)
│  ├─ lib/
│  │  ├─ db.ts                Prisma client singleton (edge-aware)
│  │  ├─ auth.ts              Better Auth config + role helpers
│  │  ├─ rbac.ts              can(role, action) — single authority for permissions
│  │  ├─ payroll/             pure calculation functions (no I/O) — unit-tested
│  │  └─ money.ts             USD/KHR, rounding rules
│  ├─ components/             ui/ (shadcn), charts/, tables/, forms/
│  └─ types/
├─ tests/                     vitest — payroll math + rbac are the priority targets
└─ env / config files
```

**Principle:** business math lives in `lib/payroll/` as pure functions that take
plain data and return plain data. Server Actions are thin: authorize → load →
call pure function → persist → audit. This is what makes payroll testable without
a database and what keeps the rules in one place instead of smeared across the UI.

---

## 3. Load-bearing decisions (the expensive-to-reverse ones)

### 3.1 Payslips snapshot their inputs — they do not recompute forever
A payslip stores the resolved numbers (days worked, OT hours, OT amount, base, bonus,
deductions, gross, net, the exchange rate used) **and** a JSON line-item breakdown,
*at generation time*. Attendance and rates can change afterward; a finalized payslip
never moves. A period can be re-run (regenerating draft payslips) until it is
**locked**, after which payslips are immutable and only a reversing entry can adjust pay.
> Without this, "what did we actually pay Oun Channak on 30 June" becomes unanswerable
> the moment any source row is edited. This is the one decision the whole money story
> rests on.

### 3.2 Integer employee IDs are the only join key
Names exist in Khmer, Chinese, and romanized English and disagree across files — this
already caused an OT mis-assignment in the spreadsheet phase. Nothing joins on a name.
Ever. Names are display labels hanging off a stable numeric identity.

### 3.3 Attendance is modeled as marks, not timestamps
Storage mirrors the factory's model: per employee, per date, an AM status and a PM
status ∈ {PRESENT, LEAVE, ABSENT}. A "day worked" = (AM==PRESENT)·0.5 + (PM==PRESENT)·0.5.
This makes the half-day cases in the real data (0.5 permitted leave) representable
exactly, and means the UI grid maps 1:1 to a row. We are **not** modeling clock-in
times we don't have.

### 3.4 Edge-compatible database access
Cloudflare Pages runs on the edge runtime, which has no raw TCP sockets. Prisma must
talk to Postgres over a driver that works there — Prisma Accelerate, or an HTTP/WebSocket
Postgres (e.g. Neon serverless driver), configured in `lib/db.ts`. Local dev uses a
normal Postgres connection. This is decided now because choosing a non-edge driver would
force a rewrite of every data access path at deploy time.

### 3.5 OT value is derived, never trusted
An OT incident stores `date`, `hours`, and `band` (NORMAL_1_5 | NIGHT_2_0 | HOLIDAY_2_0).
The dollar amount is computed = hours × hourlyRate × bandMultiplier, where hourlyRate is
derived from the employee's daily rate. Hand-typed totals from the old sheet are imported
as historical reference only, not as the source of truth going forward.

---

## 4. Security architecture (expanded by Security Engineer in its own pass)

- All mutations go through Server Actions; each begins with an `authorize(role, action)`
  check via `lib/rbac.ts`. No action trusts the client for identity or role.
- Prisma parameterizes all queries → SQL injection closed by construction.
- React escapes output → stored-XSS surface limited to any raw HTML we render (we render none).
- CSRF: Server Actions are origin-checked; Turnstile guards the login form.
- Secrets only in env (DB URL, auth secret, R2 keys); never in client bundles.
- Security headers + CSP set at the edge.
- File uploads (R2, for scanned docs later) validated by type + size, served from a
  separate origin.

---

## 5. Scalability note

At ~38 employees and semi-monthly runs, data volume is tiny; the system is correctness-
and auditability-bound, not throughput-bound. We optimize for *clarity and traceability*
over raw performance. Indices (in schema) cover the only hot query shapes: attendance by
(employee, date) and payslip by (period). Premature sharding/caching is explicitly avoided.
