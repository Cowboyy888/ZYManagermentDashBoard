# ZY Steel HR Dashboard — UAT Test Plan

**Version:** 1.0  
**System:** ZY Steel ERP v0.2.0  
**Testing Period:** To be scheduled before go-live  
**Acceptance Criterion:** All Priority 1 scenarios pass with no critical defects.

---

## 1. Test Environment

- **URL:** `https://staging-hr.zysteel.com` (staging environment)
- **Database:** Staging Neon database with representative seed data
- **Test Accounts:** Created by IT Admin before UAT begins

| Test Account | Role | Username |
|---|---|---|
| HR Admin | HR_MANAGER | hr.admin@zysteel.com |
| Department Head | SUPERVISOR | dept.head@zysteel.com |
| Read-Only | VIEWER | viewer@zysteel.com |
| System Admin | OWNER | admin@zysteel.com |
| Customer Portal | CUSTOMER_PORTAL | customer@test.com |

---

## 2. HR Module

### HR-01 — Employee Onboarding

**Actors:** HR Admin  
**Priority:** P1

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Login as HR Admin | Dashboard loads; sidebar shows all HR modules | |
| 2 | Navigate to Employees → Add Employee | Employee form opens | |
| 3 | Fill all required fields: name_en, hire_date, daily_rate_usd | Form accepts input | |
| 4 | Upload a profile photo | Photo preview appears | |
| 5 | Select department and position | Dropdowns populate correctly | |
| 6 | Click Save | Employee created; redirected to employee profile | |
| 7 | Search for the new employee in the employee list | Employee appears in search results | |
| 8 | Open the employee profile | All entered data is correct | |

**Acceptance Criteria:** Employee is saved in database; photo uploaded; record searchable.

---

### HR-02 — Attendance Recording

**Actors:** HR Admin, Supervisor  
**Priority:** P1

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Navigate to Attendance | Monthly grid loads for current month | |
| 2 | Select an employee and click a date cell | Status picker appears (PRESENT/ABSENT/HALF_DAY/HOLIDAY) | |
| 3 | Mark as PRESENT for AM and PM | Cell turns green | |
| 4 | Mark as ABSENT | Cell turns red | |
| 5 | Navigate to next month | Grid updates correctly | |
| 6 | Login as Supervisor → navigate Attendance | Only sees own department employees | |

**Acceptance Criteria:** Attendance records save correctly; supervisor scope is enforced.

---

### HR-03 — Leave Request & Approval

**Actors:** Supervisor (requester), HR Admin (approver)  
**Priority:** P1

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Login as Supervisor → Leave → Request Leave | Leave form opens | |
| 2 | Select leave type, dates, reason → Submit | Request created with PENDING status | |
| 3 | Login as HR Admin → Leave | Pending request visible | |
| 4 | Click Approve | Status changes to APPROVED | |
| 5 | Login as Supervisor | Leave shows APPROVED status | |
| 6 | HR Admin rejects a different request | Status changes to REJECTED with reason | |

**Acceptance Criteria:** Leave flow completes end-to-end; status transitions are correct.

---

### HR-04 — Payroll Processing

**Actors:** HR Admin, Owner  
**Priority:** P1

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Navigate to Payroll → Run Payroll | Period selection appears | |
| 2 | Select current month → Calculate | Payroll entries generated for all active employees | |
| 3 | Review individual payslip | Shows base pay, overtime, deductions, net pay | |
| 4 | Login as Owner → Payroll → Lock Payroll | Period locked; no further edits allowed | |
| 5 | Download payslip PDF | PDF generates with correct data | |
| 6 | Attempt to edit locked payroll as HR Admin | Edit is blocked | |

**Acceptance Criteria:** Payroll calculates correctly; locking prevents edits; PDF exports.

---

## 3. Production Module

### PROD-01 — Production Order Lifecycle

**Actors:** HR Manager, Supervisor  
**Priority:** P1

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Navigate to Production → Orders → New Order | Order form opens | |
| 2 | Select product, target quantity, target date | Form accepts input | |
| 3 | Submit → Status: DRAFT | Order appears in DRAFT list | |
| 4 | Click Start Production → Status: IN_PROGRESS | Status changes | |
| 5 | Enter actual output quantity → Complete | Status changes to COMPLETED | |
| 6 | View production report for the period | Order appears in report | |

---

### PROD-02 — Machine Status Update

**Actors:** Supervisor  
**Priority:** P2

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Navigate to Smart Factory → Machines | Machine grid loads with status indicators | |
| 2 | Click a machine → Machine Detail | Detail page shows metrics, alarms, logs | |
| 3 | Create a maintenance alarm | Alarm appears in alarm center | |
| 4 | Acknowledge the alarm | Status changes to ACKNOWLEDGED | |
| 5 | Navigate to Factory Overview | Machine shows correct status on digital twin | |

---

### PROD-03 — Daily Production Report

**Actors:** Supervisor  
**Priority:** P2

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Navigate to Production → Daily Reports → New | Report form opens with today's date | |
| 2 | Fill in area, shift, output kg | Form accepts values | |
| 3 | Submit | Report saved; appears in list | |
| 4 | Navigate to Smart Factory → Shifts | Today's totals reflect submitted report | |

---

## 4. Warehouse Module

### WH-01 — Stock In

**Actors:** HR Manager, Supervisor  
**Priority:** P1

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Navigate to Inventory → Transactions → New Transaction | Transaction form opens | |
| 2 | Select type: IN, item, warehouse, quantity | Form accepts input | |
| 3 | Submit | Stock level increases; transaction recorded | |
| 4 | View item detail | currentStock is updated | |

---

### WH-02 — Stock Out

**Priority:** P1

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | New transaction → type: OUT | Form opens | |
| 2 | Select item with insufficient stock → Submit | Error: "Insufficient stock" | |
| 3 | Select item with sufficient stock → Submit | Transaction recorded; stock decreases | |

---

### WH-03 — Stock Transfer

**Priority:** P2

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | New transaction → type: TRANSFER | Source and destination warehouse fields appear | |
| 2 | Fill form → Submit | Stock decreases in source; increases in destination | |

---

## 5. Purchasing Module

### PUR-01 — Purchase Requisition

**Actors:** Supervisor (create), HR Manager (approve)  
**Priority:** P1

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Purchasing → Requisitions → New | Form opens | |
| 2 | Add items with quantities and estimated cost | Line items added | |
| 3 | Submit | Requisition in PENDING status | |
| 4 | HR Manager → Approve | Status: APPROVED | |
| 5 | HR Manager → Create PO from requisition | PO created pre-populated | |

---

### PUR-02 — Purchase Order & Goods Receipt

**Priority:** P1

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Purchasing → Orders → New PO | PO form opens | |
| 2 | Select supplier, add line items → Submit | PO in DRAFT status | |
| 3 | Send to supplier → Status: SENT | Status updates | |
| 4 | Receive goods → Create receipt | Receipt form shows PO lines | |
| 5 | Confirm receipt | Inventory stock increases; PO marked PARTIALLY_RECEIVED or RECEIVED | |

---

## 6. Sales Module

### SALES-01 — Quotation to Sales Order

**Actors:** HR Manager  
**Priority:** P1

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Sales → Quotations → New | Quotation form opens | |
| 2 | Select customer, add line items (product, qty, price) | Lines appear in quotation | |
| 3 | Submit | Quotation in DRAFT | |
| 4 | Send to customer → Status: SENT | |
| 5 | Customer accepts → Convert to Sales Order | SO created from quotation data | |
| 6 | Approve SO | Status: APPROVED | |
| 7 | Create delivery | Delivery linked to SO | |
| 8 | Mark delivery complete | Stock decreases; SO marked DELIVERED | |

---

### SALES-02 — Customer Portal

**Actors:** Customer Portal user  
**Priority:** P2

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Login at `/portal/login` | Portal dashboard loads | |
| 2 | View own orders | Only own data visible | |
| 3 | Download invoice PDF | Invoice generates correctly | |
| 4 | Submit a support ticket | Ticket created; visible to HR Admin | |

---

## 7. Finance Module

### FIN-01 — Invoice & Payment

**Actors:** HR Manager  
**Priority:** P1

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Finance → Invoices → New | Invoice form opens | |
| 2 | Link to a sales order → auto-populate | Invoice pre-filled from SO | |
| 3 | Submit | Invoice in DRAFT | |
| 4 | Approve → Status: APPROVED | |
| 5 | Record payment | Payment linked to invoice | |
| 6 | Mark invoice PAID | Balance due = 0 | |

---

### FIN-02 — Expense Recording

**Priority:** P2

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Finance → Expenses → New | Expense form opens | |
| 2 | Enter category, amount, date, description | Form accepts input | |
| 3 | Upload receipt (optional) | Receipt stored | |
| 4 | Submit | Expense appears in expense list and BI report | |

---

## 8. Cross-Module & System Tests

### SYS-01 — Security Boundary Check

**Priority:** P1

| Scenario | Expected Result | Pass/Fail |
|---|---|---|
| VIEWER navigates to Payroll → Run Payroll | Redirected or button disabled | |
| SUPERVISOR edits employee in different department | Action blocked by RBAC | |
| Unauthenticated user accesses `/employees` | Redirected to `/login` | |
| Unauthenticated access to `/uploads/photo.jpg` | Redirected to `/login` | |
| CUSTOMER_PORTAL user accesses `/payroll` | Redirected to `/login` | |

---

### SYS-02 — Data Export

**Priority:** P2

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| 1 | Any list page → Export → Excel | Download starts; file opens correctly in Excel | |
| 2 | Payslip → Export PDF | PDF opens; data is correct | |

---

## 9. Defect Classification

| Severity | Definition | SLA |
|---|---|---|
| **Critical** | Data loss, security breach, core workflow blocked | Fix before go-live |
| **Major** | Feature incorrect but workaround exists | Fix before go-live |
| **Minor** | UI cosmetic, non-blocking | Can go-live; fix in next release |

---

## 10. Sign-Off

| Tester | Department | Date | Signature |
|---|---|---|---|
| | HR | | |
| | Production | | |
| | Warehouse | | |
| | Purchasing | | |
| | Sales | | |
| | Finance | | |
| IT Administrator | IT | | |
