# Stage 2 — Operations modules

Built on the Stage 1 foundation. Adds auth, RBAC, employee management, the
attendance grid, and overtime entry. 26 unit tests passing (RBAC + payroll +
attendance).

## What's new

### Auth + RBAC (`src/lib/rbac.ts`, `src/lib/auth/`)
- Four roles: OWNER, HR_MANAGER, SUPERVISOR, VIEWER.
- A single `can(role, action, ctx)` authority — the only place permission logic
  lives. Every Server Action calls `guard()` before touching data.
- SUPERVISOR is **department-scoped**: can only write attendance / OT for their
  own line. Verified per-row, not just per-request.
- Better Auth config with session-based login, role + departmentId on the session.
- 11 RBAC tests cover the matrix and the scoping edge cases (no-department
  supervisor, cross-department denial, owner override).

### Employee Management (`src/actions/employees.ts`, `src/components/`)
- Full CRUD as Server Actions: list (with tri-script search), create, update,
  soft-delete (terminate — never hard-delete, to preserve payroll/audit history).
- Zod validation at the boundary; server re-validates everything.
- TanStack Table UI with search across English / Khmer / Chinese names.
- Add/edit form with client + server validation, field-level errors.

### Attendance (`src/actions/attendance.ts`, `src/components/AttendanceGrid.tsx`)
- Bulk period upsert; unique by (employee, date) so re-saving overwrites cleanly.
- The grid mirrors the factory's √/△/× AM-PM model exactly — click to cycle,
  live present/leave/absent day totals.

### Overtime (`src/actions/attendance.ts`)
- Per-incident entry with rate band; dollar value derived via the validated
  pure calc, honouring the configured OT mode (FLAT_TIER default).

## Finding: the source spreadsheet had silent counting errors

While validating the attendance resolver against the real sheet, 33/38 employees
matched its own √/△/× totals exactly. The other 5 (chea somnag, Moung Sophann,
Chea Chean, Thol Saoren, Thorn ChanThy) **each had a leave count one day higher
in the sheet's summary column than its own daily marks supported.** The daily
√/△/× cells are correct; the sheet's half-month summary formulas over-count leave
by a day. Example: Chea Chean has 55 √ + 5 △ across 30 day-halves → 27.5 present,
2.5 leave; the sheet's summary says 3.5 leave.

This is a pre-existing spreadsheet bug, not a model error — and exactly the class
of silent mistake the new system eliminates by deriving totals from the marks
instead of from hand-maintained summary cells. The attendance tests pin the
correct behaviour.

## Run it

```bash
npm install
npm test                 # 26 tests
npm run db:migrate && npm run db:seed
npm run dev
```

## Next (Stage 3)
Payroll run + immutable payslips (the engine is already built and validated in
Stage 1), then Reports/Exports (PDF/Excel/CSV).
