# ZYSTEEL HR — Attendance & Payroll

Production HR system for 中粤铁网 ZYSTEEL Mesh Factory (Cambodia).
Replaces the hand-maintained Excel/xlsm payroll with a deployable,
auditable, role-controlled web application.

> **Status: Stage 1 foundation.** Data model, payroll math, and seed are
> built and **validated against the real June 2026 payroll** (reproduces the
> $6,555.13 gross total to within rounding). UI modules build on top of this
> in later stages — see `docs/product.md` §3 for the staged roadmap.

---

## What's here

```
docs/product.md        Requirements, roles, module roadmap (grounded in the real factory)
docs/architecture.md   Decisions — esp. the load-bearing ones (payslip snapshots, edge driver)
prisma/schema.prisma   PostgreSQL data model
prisma/seed.ts         Real 38-employee roster + reconstructed OT + holidays + admin user
src/lib/payroll/calc.ts  Pure payroll math (the single source of truth for pay)
tests/payroll.test.ts  Unit tests — 8 passing, lock in the validated behaviour
```

## The one thing to understand about this system

**Overtime has two valuation modes, and the default matches what the factory
actually pays — not what we first assumed.**

During validation we discovered ZYSTEEL pays OT as **flat $/hour tiers**
($1.25 normal, $2.00 night/holiday), *independent of the worker's wage*. Our
initial Labour-Law model (hours × dailyRate/8 × multiplier) overpaid by ~$37
across the roster. Both modes now exist; the mode is a row in the `Setting`
table (`overtime_mode`), defaulting to `FLAT_TIER`. Switch to `RATE_DERIVED`
when you want strict Labour-Law compliance (which pays higher-wage staff more).

This is documented because it's the kind of thing that silently corrupts a
payroll system: the math looked "correct" and was still wrong for *this*
business. The tests pin the real behaviour so it can't regress.

## Tech stack

Next.js 15 (App Router) · TypeScript · Tailwind + shadcn/ui · Prisma + PostgreSQL ·
Better Auth (RBAC) · TanStack Table · Recharts · Framer Motion.
Deploy target: Cloudflare Pages + R2 + Turnstile (edge-compatible Postgres driver — see architecture §3.4).

## Local setup

```bash
# 1. Install
npm install

# 2. Database (local Postgres)
cp .env.example .env          # set DATABASE_URL
npx prisma migrate dev        # create schema
npx prisma db seed            # load the real roster

# 3. Verify the payroll math
npm test                      # 8 tests, all green

# 4. Dev server (once UI modules land)
npm run dev
```

Default admin after seeding: `admin@zysteel.local` / `change-me-on-first-login`
— **change this immediately.**

## Roadmap (from docs/product.md)

- **Stage 1 ✓** Data model · payroll math · seed · tests  ← *you are here*
- **Stage 2** Employee CRUD · Attendance grid (√/△/×) · Overtime entry · Auth+RBAC
- **Stage 3** Payroll run + immutable payslips · Reports/Exports (PDF/Excel/CSV)
- **Stage 4** Dashboard KPIs+charts · Analytics · Audit log UI · Settings

Each stage is independently shippable. The data model and pure-math core are
deliberately built first because everything else depends on them.

## Why no UI yet

The brief asked for everything at once. Building the schema and the validated
payroll engine *first* is what makes the rest safe to build — a beautiful
dashboard over wrong numbers is worse than no dashboard. With the foundation
proven against real data, the UI modules become mechanical.
