# ZY Steel HR Dashboard — Administrator Guide

---

## 1. Roles & Permissions

| Role | Description | Typical Users |
|---|---|---|
| **OWNER** | Full system access, including user management, payroll lock, finance manage | IT Admin, CEO |
| **HR_MANAGER** | All HR, payroll, production, purchasing, sales, finance read/write (no finance manage) | HR Director |
| **SUPERVISOR** | Read all modules; write attendance, overtime, leave, production for own department | Department Head |
| **VIEWER** | Read-only access to HR, attendance, production, inventory, BI | Auditor, observer |
| **CUSTOMER_PORTAL** | Portal-only: own orders, quotations, invoices, messages | External customer |
| **SUPPLIER_PORTAL** | Portal-only: own orders, deliveries, payments, messages | External supplier |

### Changing a User's Role

1. Log in as **OWNER**
2. Go to **Admin → Users**
3. Find the user, click **Edit**
4. Select the new role → **Save**

Role changes take effect on the user's next page load (session is re-read per request).

---

## 2. User Management

### Creating a New Internal User

1. Go to **Admin → Users → Add User**
2. Enter name, email, password, and role
3. User can log in immediately at `/login`

### Resetting a Password

Direct password resets are done by the user via the login page (if the email provider is configured) or by the OWNER directly updating the user record:

```bash
# Via Prisma Studio (run locally against staging DB)
npx prisma studio
# Navigate to User model → find user → update passwordHash

# Or via seed script: create a new user with known credentials
```

### Disabling a User

1. Go to **Admin → Users**
2. Toggle **Active** off
3. The user will be denied on their next request

---

## 3. Data Import

### Bulk Import Workflow

1. Log in as **OWNER** or **HR_MANAGER**
2. Go to **Admin → Data Import**
3. Select the entity type (Departments first, then Positions, then Employees)
4. Click **Download CSV Template**
5. Fill in the spreadsheet (Excel or LibreOffice Calc)
6. **File → Save As → CSV (comma-delimited)**
7. Upload the CSV → **Import**
8. Review the error table; fix errors in the source file and re-import

### Import Order (Dependencies)

```
Factory Areas   ← no dependencies
Departments     ← no dependencies
Positions       ← no dependencies
Machines        ← depends on: Factory Areas
Employees       ← depends on: Departments, Positions, Factory Areas
Customers       ← no dependencies
Suppliers       ← no dependencies
```

Always import in dependency order. The import actions upsert (create-or-update) based on the unique code column, so re-running an import is safe.

### Common Import Errors

| Error | Cause | Fix |
|---|---|---|
| `dept code "PROD" not found` | Department not imported yet | Import departments first |
| `required` on `name` field | Cell is empty | Fill the required column |
| `unique constraint` | Duplicate code in the file | Remove duplicate rows |
| `invalid date` | Date format not YYYY-MM-DD | Use ISO 8601 (e.g. `2024-01-15`) |

---

## 4. System Health Monitoring

Go to **Admin → System Health** to see:

- Database connectivity (live check)
- Active user count
- Pending leave/overtime requests
- Open production orders
- Low stock items
- Cron job schedule

The machine-readable endpoint at **`GET /api/health`** returns JSON. Connect it to UptimeRobot or Pingdom for automated monitoring.

---

## 5. Audit Log

Go to **Admin → Audit Log** to view all recorded actions.

The audit log records:
- **Who** performed the action (user name + email)
- **What** was done (action verb, e.g. `employee.create`)
- **Which entity** was affected (type + ID)
- **Before/after** JSON snapshots of the record
- **IP address** and user agent
- **When** (timestamp, newest first)

Filter by entity type (Employee, Payslip, etc.) or search by user name, action, or IP.

Audit entries are **immutable** — there is no delete or edit operation on audit logs.

---

## 6. Cron Jobs

The following automated jobs run on the schedule below. They send Telegram notifications when `TELEGRAM_BOT_TOKEN` is set.

| Job | Schedule | What it does |
|---|---|---|
| Daily Report | 07:00 daily | Attendance summary, production status, machine status |
| Contract Expiry | 08:00 daily | Lists employees whose contracts expire within 30 days |
| Low Stock | 08:30 daily | Items at or below minimum stock threshold |
| Maintenance Due | 09:00 daily | PM schedules due within 7 days |
| Payroll Reminder | 09:30 on the 25th | Reminds HR to run payroll |

To test a cron job manually:

```bash
curl -X POST https://hr.zysteel.com/api/cron/daily-report \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

---

## 7. Backup & Restore

### Database Backup

```bash
# Full export
pg_dump "$DATABASE_URL" --no-owner --no-acl -Fc -f backup.dump

# Restore to a clean database
pg_restore -d "$TARGET_DATABASE_URL" --no-owner --clean backup.dump
```

Neon also provides PITR (point-in-time restore) from the dashboard.

### Schema-Only Backup

```bash
npx prisma db pull           # introspects live DB → schema.prisma
npx prisma migrate diff ...  # shows schema delta
```

---

## 8. Performance Tuning

### Database

- Add indexes for your most-common queries via `@@index` in `schema.prisma` → `prisma db push`
- Enable Neon autoscaling (Pro tier) for peak payroll processing days
- Monitor query performance in the Neon dashboard → Monitoring tab

### Application

- Next.js pages with `export const dynamic = "force-dynamic"` always server-render; pages without this directive are statically generated at build time
- The BI dashboard routes use Recharts; large datasets should be aggregated in the server action, not returned raw
- Vercel Edge Cache: API routes that are not `force-dynamic` are automatically cached

---

## 9. Troubleshooting

### "Not Authorized" after login

User's role may not have the required permission. Check **Admin → Users** and verify the role is correct.

### Build fails with "ignoreBuildErrors: false"

TypeScript errors block the build. Run `npx tsc --noEmit` locally to identify and fix errors before pushing.

### Cron jobs not running

1. Verify `CRON_SECRET` is set in Vercel env vars
2. Check Vercel dashboard → **Logs → Cron** tab
3. Test manually with curl (see §6)

### Session expires too quickly

Better Auth default session lifetime is 7 days. This is configured in `src/lib/auth/config.ts`. Adjust `session.expiresIn` if needed.
