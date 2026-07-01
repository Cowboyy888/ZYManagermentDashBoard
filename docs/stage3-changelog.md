# Stage 3 — Payroll runs, exports, and the unified dashboard

Completes the money layer and assembles everything into one web dashboard.
34 unit tests passing (RBAC + payroll + attendance + run engine).

## What's new

### Payroll run engine (`src/lib/payroll/run.ts`)
- Pure assembly: takes a period's employee rates + resolved attendance days +
  summed OT, returns payslip line-items with a full reproducible breakdown.
- `runPayroll()` produces per-employee payslips plus run totals.
- `payrollToCsv()` — Excel-ready export with proper escaping and Khmer unicode.
- 8 new tests, including a full-roster reconciliation that reproduces the
  validated **$6,555.13** gross total end-to-end through the run engine.

### Payroll Server Actions (`src/actions/payroll.ts`)
- `runPayrollForPeriod()` — loads active employees + attendance + approved OT in
  the window, resolves days from marks, generates **snapshot payslips** in one
  transaction (arch §3.1). Re-runnable until locked.
- `lockPeriod()` — finalizes payslips; immutable afterward (Owner only).
- `exportPayrollCsv()` — server-side CSV generation, permission-gated.
- All actions authorize → load → compute (pure) → persist → audit.

### The unified dashboard (`zysteel-hr-dashboard.html`)
A single self-contained web application — no build step, no server, opens in any
browser. This is the "one dashboard system on web" deliverable. It runs on the
real 38-employee June data and includes:

- **Sidebar navigation** across six modules, steel-themed for the factory.
- **Dashboard home** — six KPIs, salary-distribution chart (the wage structure),
  attendance breakdown, and overtime-by-employee bars.
- **Employees** — sortable, tri-script searchable table (English / ខ្មែរ / 中文).
- **Attendance** — the √/△/× AM-PM grid, click-to-cycle, live day totals, plus
  the validation banner flagging the 5 source-sheet leave-count errors.
- **Overtime** — incident log with flat-tier rate bands and totals.
- **Payroll** — draft → run → lock flow with immutability, and the full payslip
  table with USD + KHR columns.
- **Reports** — export cards (CSV / summary / department), department rollup,
  and working CSV download.
- Light/dark mode, responsive (mobile sidebar collapses), keyboard-accessible.

Verified with jsdom: all six views render, search filters, payroll run generates
its table, zero JS errors.

## How the pieces relate

```
Stage 1: data model + pure payroll math  ──┐
Stage 2: auth/RBAC + employees + attendance ├─→ Stage 3: run engine + dashboard
Stage 1: (validated $6,555.13 baseline)   ──┘
```

The Next.js app (src/) and the standalone dashboard (.html) share the same
logic and the same validated numbers. The .html is what you can open today; the
src/ tree is what deploys to Cloudflare once Postgres + auth are provisioned.

## Run

```bash
npm install && npm test        # 34 tests
# Open the dashboard directly:
open zysteel-hr-dashboard.html
# Or run the full app (needs Postgres + env):
npm run db:migrate && npm run db:seed && npm run dev
```

## Honest status
- The **dashboard.html** is fully working and standalone — real data, real
  interactions, real CSV export.
- The **Next.js app** logic layers are all tested; the React pages render against
  live Server Actions once you connect Postgres and Better Auth. In this
  environment there's no live DB, so those paths are built and type-consistent
  but not exercised end-to-end here.
- Payroll figures use the factory's **flat-tier OT** (validated). Flip to
  Labour-Law rate-derived in Settings if you want stricter compliance.
