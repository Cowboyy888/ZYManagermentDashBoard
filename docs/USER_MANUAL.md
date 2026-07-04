# ZY Steel HR Dashboard — User Manual

**Version:** 0.2.0  
**URL:** `https://hr.zysteel.com`

---

## 1. Getting Started

### Logging In

1. Open `https://hr.zysteel.com` in your browser (Chrome or Edge recommended)
2. Enter your email and password
3. Click **Sign In**

If you forget your password, contact your HR Administrator.

### Navigation

The sidebar on the left shows all modules available to your role. Click any item to open it. The top bar has a search box (search employees, orders, customers by name or code) and a notification bell.

### Your Role

What you can see and do depends on your role:

| Role | Can do |
|---|---|
| OWNER | Everything |
| HR_MANAGER | All modules except finance manage |
| SUPERVISOR | Manage own department's attendance, leave, production |
| VIEWER | Read only across all modules |

---

## 2. HR — Employees

### Finding an Employee

- Use the **search bar** at the top to search by name or employee code
- Or go to **Employees** → use the filter tabs (Active / Inactive) and search box

### Adding an Employee

1. Go to **Employees** → **Add Employee**
2. Fill in the required fields (marked with \*)
   - Full name (English and Khmer)
   - Hire date
   - Daily rate (USD)
3. Upload a profile photo (optional)
4. Select department, position, and factory area
5. Click **Save**

### Editing an Employee

1. Open the employee profile (click name in the list)
2. Click **Edit** on any section
3. Make changes → **Save**

### Employee Profile Sections

| Section | Contents |
|---|---|
| Overview | Photo, name, code, department, position |
| HR Details | Hire date, salary grade, shift, supervisor |
| Contact | Phone, email, emergency contact |
| Attendance | Monthly attendance grid |
| Leave | Leave balance and history |
| Payslips | Pay history |
| Documents | Uploaded contracts, ID copies |

---

## 3. HR — Attendance

### Recording Attendance

1. Go to **Attendance**
2. Select the month using the navigation arrows
3. Click any cell in the grid (employee × date) to set status:
   - **P** (green) — Present
   - **A** (red) — Absent
   - **H** (yellow) — Half Day
   - **L** (blue) — On Leave
   - **PH** (gray) — Public Holiday

Attendance is saved automatically when you click a status.

### Attendance Tips

- Supervisors can only edit their own department's attendance
- Lock the month at month-end to prevent changes (HR Manager or above)
- Export the monthly report to Excel via the **Export** button

---

## 4. HR — Leave

### Requesting Leave (Supervisor)

1. Go to **Leave** → **Request Leave**
2. Select leave type (Annual / Sick / Emergency / Maternity)
3. Enter start date, end date, and reason
4. Click **Submit**

Your request will be in **PENDING** status until approved by HR.

### Approving Leave (HR Manager)

1. Go to **Leave** → pending requests tab
2. Review the request details
3. Click **Approve** or **Reject** (provide reason when rejecting)

### Leave Balances

Each employee's remaining balance by type is shown in their profile under the **Leave** tab.

---

## 5. HR — Payroll

### Running Payroll (HR Manager)

1. Go to **Payroll** → **Run Payroll**
2. Select the pay period (month and year)
3. Click **Calculate** — the system computes base pay, overtime, deductions
4. Review individual payslips
5. Make any adjustments (bonuses, deductions)
6. Click **Finalize** to mark payroll as ready for payment

### Locking Payroll (Owner Only)

Once locked, no further edits are possible. Lock after confirming all figures are correct.

### Downloading Payslips

From an individual payslip page, click **Download PDF** to generate the employee's payslip.

---

## 6. Production

### Production Orders

| Status | Meaning |
|---|---|
| DRAFT | Created, not started |
| IN_PROGRESS | Production running |
| COMPLETED | Output recorded |
| CANCELLED | Order cancelled |

**Create order:** Production → Orders → New → select product, quantity, target date → Submit  
**Start order:** Open order → Start Production  
**Complete order:** Enter actual output quantity → Complete

### Daily Production Report

1. Production → Daily Reports → New
2. Select factory area, shift, date
3. Enter output in kg, notes
4. Submit

Reports feed into the Smart Factory shift summary and the executive dashboard.

### Smart Factory (Machines)

- **Overview:** Visual map of all factory areas with real-time machine statuses
- **Machine Detail:** Click any machine to see metrics, active alarms, OEE data, maintenance history
- **Alarms:** Acknowledge and resolve alarms from the Alarm Center
- **TV Mode:** Open `/factory/tv` on a display screen for a live production dashboard (auto-refreshes every 10 seconds)

---

## 7. Inventory

### Stock Levels

Go to **Inventory → Items** to see current stock for all items. Items below minimum stock appear with a warning badge.

### Recording Transactions

1. Inventory → Transactions → New
2. Select type:
   - **IN** — stock received
   - **OUT** — stock consumed or issued
   - **TRANSFER** — moved between warehouses
   - **ADJUSTMENT** — correction (requires reason)
3. Select item, warehouse, quantity, reference number
4. Submit → stock level updates automatically

---

## 8. Purchasing

### Purchase Requisition → Purchase Order → Receipt Flow

1. **Requisition:** Supervisor requests items → HR Manager approves
2. **Purchase Order:** HR Manager creates PO, selects supplier, sends to supplier
3. **Goods Receipt:** When goods arrive, create a receipt against the PO → inventory increases

### Viewing Supplier Info

Purchasing → Suppliers → click supplier name → see contact info, payment terms, order history.

---

## 9. Sales

### Quotation → Sales Order → Delivery Flow

1. **Lead/Inquiry:** Log the customer inquiry in Sales → Leads
2. **Quotation:** Create quotation with pricing, send to customer for approval
3. **Sales Order:** Once accepted, convert quotation to sales order → approve
4. **Delivery:** Create delivery note → mark as delivered → inventory decreases
5. **Invoice:** Finance creates invoice from the sales order → record payment

### Customer Portal

Customers with portal accounts can log in at `/portal/login` to:
- View their orders, quotations, invoices
- Download invoices as PDF
- Submit support tickets

---

## 10. Finance

### Invoice Management

Finance → Invoices → New → link to sales order → system pre-fills customer and amounts.

Invoice statuses: **DRAFT → APPROVED → SENT → PARTIALLY_PAID → PAID**

### Recording Payments

Open an invoice → Add Payment → enter amount, date, payment method → Save.

### Expense Tracking

Finance → Expenses → New → enter category (Materials, Utilities, Transport, etc.), amount, date, description → upload receipt → Submit.

---

## 11. Business Intelligence

**BI → Dashboard** shows key metrics across all departments:
- HR headcount, attendance rate, payroll cost
- Production output vs target
- Inventory levels, low stock alerts
- Sales pipeline, revenue trend
- Quality KPIs

**Executive Dashboard** combines all KPIs in one view (OWNER/HR_MANAGER access).

---

## 12. AI Assistant

Three AI assistants are available:
- **AI → HR Assistant** — ask questions about policies, employee data summaries
- **AI → Production AI** — query production metrics, OEE, shift performance
- **AI → Sales AI** — customer revenue, pipeline, quotation status

All AI responses are based on your company's actual data.

---

## 13. Notifications

The bell icon (top right) shows unread notifications. Notifications are generated for:
- Pending leave/overtime requests (for approvers)
- Low stock alerts
- Contract expiry warnings
- Cron job alerts via Telegram (if configured)

---

## 14. Keyboard Shortcuts & Tips

| Tip | How |
|---|---|
| Global search | Click the search bar at the top (searches employees, orders, customers) |
| Quick employee lookup | Type employee code or name in global search |
| Export any list to Excel | Click the Export button (top-right of most tables) |
| Print payslip | Open payslip → Download PDF |
| Access audit trail | Admin → Audit Log (OWNER/HR_MANAGER only) |
