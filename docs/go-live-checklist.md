# ZY Steel HR Dashboard — Go-Live Checklist

## Pre-Deployment

### Environment Configuration
- [ ] `DATABASE_URL` set to production PostgreSQL connection string
- [ ] `AUTH_SECRET` set to a 32-byte random value (`openssl rand -base64 32`)
- [ ] `AUTH_URL` set to production domain (e.g. `https://hr.zysteel.com`)
- [ ] `CRON_SECRET` set to a 64-char hex value (`openssl rand -hex 32`)
- [ ] `NEXT_PUBLIC_APP_URL` set to production domain
- [ ] `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` configured (optional but recommended)
- [ ] `ANTHROPIC_API_KEY` configured if AI assistant is required
- [ ] Verify `.env.example` matches all required variables — no undocumented env vars

### Database
- [ ] PostgreSQL 15+ instance provisioned and accessible
- [ ] Run `npx prisma generate` after any schema change
- [ ] Apply the production migration SQL below (do NOT run `prisma migrate` in production)
- [ ] Verify seed data with `npm run db:seed` on a staging copy first
- [ ] Confirm admin user exists with correct credentials
- [ ] Take a full database backup before go-live

#### Production Migration SQL (apply manually)
Run this once against the production database before deploying:

```sql
-- Missing indexes for performance (added 2026-07-03)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Employee_hireDate_idx"
  ON "Employee" ("hireDate");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Employee_contractExpiry_idx"
  ON "Employee" ("contractExpiry");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "PayPeriod_payrollDate_idx"
  ON "PayPeriod" ("payrollDate");

-- userAgent column for AuditLog (if not already present)
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

-- notification table (if not already present from DDL migration)
-- Run only if the table does not exist:
-- CREATE TABLE IF NOT EXISTS "notification" ( ... );
-- (Refer to prisma/schema.prisma for the full column list)
```

### Security Verification
- [ ] Verify `/uploads/` is auth-protected (middleware no longer excludes it)
- [ ] Confirm `CRON_SECRET` is set and all `/api/cron/*` endpoints reject requests without it
- [ ] Review RBAC matrix matches business roles (see `src/lib/rbac.ts`)
- [ ] Verify session cookie is `__Secure-` prefixed on HTTPS
- [ ] Test that unauthenticated users are redirected to `/login` for all routes including `/uploads/`
- [ ] Confirm CSP headers are being sent (`X-Content-Security-Policy` in browser devtools)
- [ ] Run `npm audit` — address any high/critical findings

### Build Verification
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm run lint` → 0 errors
- [ ] `npm run test` → all tests pass (or confirmed skip for fixture-dependent tests)
- [ ] `npm run build` → clean build with 0 errors
- [ ] Verify build output includes all expected routes (check `.next/` manifest)

---

## Deployment Steps

1. **Provision database** — create PostgreSQL database, run schema DDL
2. **Set environment variables** — all required vars from `.env.example`
3. **Run `npm run build`** — confirm clean
4. **Deploy to hosting** — upload `.next/` or deploy to Vercel/Cloudflare Pages
5. **Apply production migration SQL** (see above)
6. **Run `npm run db:seed`** — seed reference data and initial admin user
7. **Verify health** — visit `/admin/health` as OWNER

---

## Post-Deployment Verification

### Smoke Tests
- [ ] Login with admin account works
- [ ] Dashboard loads with real data
- [ ] Employee list shows correct headcount
- [ ] Attendance can be saved for today
- [ ] Notifications page loads
- [ ] `/admin/health` shows DB status: Connected
- [ ] Upload an employee photo — verify file is created and requires auth to view
- [ ] Trigger a cron manually: `curl -H "x-cron-secret: $CRON_SECRET" https://hr.zysteel.com/api/cron/daily-report`

### Scheduled Jobs (configure in hosting provider)
| Job | Endpoint | Schedule | Secret Header |
|---|---|---|---|
| Daily Report | `/api/cron/daily-report` | `0 7 * * *` | `x-cron-secret` |
| Contract Expiry | `/api/cron/contract-expiry` | `0 8 * * *` | `x-cron-secret` |
| Low Stock | `/api/cron/low-stock` | `30 8 * * *` | `x-cron-secret` |
| Maintenance Due | `/api/cron/maintenance-due` | `0 9 * * *` | `x-cron-secret` |
| Payroll Reminder | `/api/cron/payroll-reminder` | `30 9 * * *` | `x-cron-secret` |

### User Acceptance Testing (UAT)
- [ ] HR Manager can create/edit/terminate employees
- [ ] Supervisor can mark attendance for their department only
- [ ] Payroll can be run and locked for a period
- [ ] Payslip prints correctly
- [ ] Sales order → goods delivery flow works end-to-end
- [ ] Purchasing: PR → PO → goods receipt updates inventory
- [ ] Quality inspection failure triggers notification
- [ ] Maintenance breakdown work order triggers critical notification
- [ ] BI dashboards display accurate data
- [ ] AI assistant responds correctly (if API key configured)
- [ ] VIEWER role cannot perform any write actions

---

## Rollback Plan

1. **Database** — restore from pre-deployment backup
2. **Application** — redeploy previous build artifact
3. **Indexes** — indexes are non-destructive; DROP IF EXISTS if needed

```sql
-- Rollback indexes (safe, non-destructive)
DROP INDEX IF EXISTS "Employee_hireDate_idx";
DROP INDEX IF EXISTS "Employee_contractExpiry_idx";
DROP INDEX IF EXISTS "PayPeriod_payrollDate_idx";
```

---

## Backup & Recovery

### Daily Backup
```bash
pg_dump $DATABASE_URL -Fc -f "zysteel_hr_$(date +%Y%m%d).dump"
```

### Restore
```bash
pg_restore -d $DATABASE_URL --clean --if-exists zysteel_hr_YYYYMMDD.dump
```

### What to back up
- PostgreSQL database (full dump nightly)
- `/public/uploads/` directory (employee photos and documents)
- `.env.local` / production environment variables (store in a secrets manager)

---

## Known Remaining Risks Before Production

| Risk | Impact | Mitigation |
|---|---|---|
| No audit logging in inventory, sales, purchasing, quality, maintenance, production, finance | Compliance gap — mutations are not attributable | Add `writeAudit()` calls to these 7 modules in a follow-up sprint |
| `/public/uploads/` on-disk file storage | Files lost if server is replaced | Migrate to Cloudflare R2 or S3 before scaling (architecture §3.4 is pre-wired) |
| `framer-motion` in `package.json` but not imported | Dead dependency (~100 KB extra download) | Remove from `package.json` and run `npm install` |
| `run.test.ts` requires `/tmp/payroll.json` fixture | Test skipped in CI | Commit fixture to `tests/fixtures/` (coordinate with payroll team on data sensitivity) |
| `AUTH_URL` defaults to `localhost:3000` if unset | All production logins will fail | Ensure `AUTH_URL` is set in production env |
| AI chat has no per-user rate limiting | Budget exhaustion if abused | Add Redis-backed rate limiting per user ID before public launch |
