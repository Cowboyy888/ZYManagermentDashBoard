# ZYSTEEL HR — Product Requirements

**Product:** Attendance & Payroll system for 中粤铁网 ZYSTEEL Mesh Factory (Cambodia)
**Owner:** SpikeShelbyy
**Status:** v0.1 — foundation
**Last updated:** 2026-06-30

---

## 1. Context (why this exists)

ZYSTEEL is a steel-mesh / wire-drawing factory in Cambodia running ~38 production
staff. Payroll today lives in hand-maintained Excel/xlsm files: a semi-monthly
salary sheet plus a daily attendance grid (上午/下午 marks: √ present, △ permitted
leave, × absent) and a separate overtime log with Labour-Law rate tiers.

This works but is fragile: OT dollars are tracked in one file and not always
carried into pay, names are matched by eye across Khmer/Chinese/English spellings,
and there is no history, audit trail, or access control. The product replaces the
spreadsheets with a deployable system that keeps the **same mental model** the
factory already uses, rather than imposing a generic HR tool.

### Design constraints that fall out of the real context
- **Bilingual identity.** Every employee has a Khmer name and often a Chinese name
  (阿山, 阿明). Both must be first-class, searchable fields. English is a romanization,
  not the canonical name.
- **Semi-monthly USD payroll.** Periods are 1–15 and 16–end-of-month. USD is the pay
  currency; KHR is display-only conversion. (Confirmed in prior payroll work.)
- **Half-day attendance, not time clocks.** A day is two marks (AM/PM). "Lateness"
  does not exist in the source data — do **not** ship a Late KPI that is structurally
  always zero. Track present-days, permitted-leave days, and absent days instead.
- **Labour-Law overtime tiers.** OT is logged per incident with a rate band
  (e.g. 16:30–18:00 = 1.5×, 18:00–20:00 / night / Sunday / holiday = 2.0×). The system
  stores hours + band and derives the dollar value; it never trusts a hand-typed total.
- **Khmer public holidays** are paid days off; work on them is 200%. The holiday
  calendar is data, not hardcode, because it changes yearly by sub-decree.
- **NSSF** (occupational risk + healthcare, employer-side) is out of scope for v1 pay
  runs but the schema must leave room for it so we don't migrate later.

---

## 2. Users & roles (RBAC)

| Role | Who | Can do |
|---|---|---|
| **OWNER** | Factory owner | Everything, incl. user management and settings |
| **HR_MANAGER** | Office admin | Manage employees, run payroll, approve leave/OT, view audit |
| **SUPERVISOR** | Line lead (行车员机长) | Record attendance, submit OT, request leave for their line |
| **VIEWER** | Accountant / read-only | View dashboards, reports, exports; no writes |

Every write action is attributed to a user and logged (see audit requirement).

---

## 3. Modules — prioritised by dependency, not by wishlist order

Scope is staged. Each stage is independently shippable and testable.

### Stage 1 — Foundation (this milestone)
1. **Data model** — employees, departments, attendance, OT, pay periods, payslips,
   holidays, users, audit log. *Everything downstream depends on this.*
2. **Employee Management** — CRUD with bilingual names, daily rate, department,
   hire date, active/terminated status. Seeded from the real June roster.
3. **Auth + RBAC** — login, the four roles above, route + action guards.

### Stage 2 — Operations
4. **Attendance** — per-period grid matching the √/△/× AM-PM model; bulk entry.
5. **Overtime** — per-incident log with rate band; dollar value derived.
6. **Leave Management** — permitted-leave requests that flow into attendance.

### Stage 3 — Money
7. **Payroll** — generate a period run: base = daily_rate × present-days,
   + OT (from logged incidents in the window) + bonus − deductions. Produces
   immutable payslips. Re-runnable until locked.
8. **Reports & Exports** — period payroll table; PDF / Excel / CSV.

### Stage 4 — Insight & control
9. **Dashboard Home** — KPIs + charts (see §4).
10. **Analytics** — trends across periods.
11. **Audit Logs** — who changed what, when.
12. **Settings** — exchange rate, OT bands, holiday calendar, company profile.
13. **Notifications** — leave/OT approvals pending. *Lowest priority; defer.*

> Departments and Role Management from the brief are folded into Employee Mgmt and
> Auth respectively — they are not large enough to be standalone modules at this scale.

---

## 4. Dashboard KPIs & charts (corrected for this factory)

**KPIs**
- Total active employees
- Present today (AM+PM resolved to a day fraction)
- On permitted leave today
- Absent today
- Current-period payroll cost (USD, live as attendance is entered)
- Current-period overtime cost (USD)

> Dropped from the generic brief: **"Late"** — not representable in source data.
> Replaced with **"On leave"**, which is.

**Charts**
- Attendance trend (present / leave / absent days per period)
- Payroll cost per period
- Salary distribution (headcount by daily-rate band) — the factory's wage structure
- Overtime cost by employee (who is carrying the OT load)
- Leave analysis (permitted-leave days by department)

---

## 5. Key user stories (Stage 1)

- *As an HR manager,* I add a new hire with their Khmer and Chinese names, daily rate,
  and start date, so they appear in the next attendance grid.
- *As a supervisor,* I can only see and edit my own line's records, so I can't alter
  another line's attendance.
- *As an owner,* I can see every change made to a payslip and by whom, so payroll is
  auditable.
- *As an accountant (viewer),* I can export the period payroll to Excel without being
  able to change any figure.

---

## 6. Non-goals (v1)

- Mobile-clock biometric integration (attendance stays grid-entered).
- Multi-factory / multi-currency payroll (single factory, USD base).
- Tax filing automation. NSSF filing automation.
- Self-service employee portal.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Name-matching errors across 3 scripts (already bit us in the Excel OT join) | Stable integer employee IDs as the only join key; names are labels |
| OT double-counting if a period boundary splits an incident | OT incidents carry a single date; payroll filters by date∈period |
| Spreadsheet users distrust a new tool | Mirror the √/△/× model exactly; ship Excel export so they can reconcile |
| Holiday calendar drift | Holidays are seeded data with an admin screen, never hardcoded |
