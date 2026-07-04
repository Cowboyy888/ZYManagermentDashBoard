# ZY Steel HR Dashboard — Go-Live Checklist

**Version:** 0.2.0 · This checklist must be completed and signed off before production deployment.

---

## Phase 1 — Infrastructure Readiness

### Hosting

- [ ] Vercel project linked to `main` branch of GitHub repo
- [ ] Production domain `hr.zysteel.com` added to Vercel project
- [ ] TLS certificate provisioned (automatic via Let's Encrypt)
- [ ] DNS CNAME/A record pointing to Vercel IP verified
- [ ] Vercel build succeeds (`npm run build` → 0 errors)

### Database

- [ ] Neon PostgreSQL project created (Pro tier recommended for PITR backups)
- [ ] Pooled connection string saved as `DATABASE_URL` in Vercel env
- [ ] `npx prisma db push` run against production database
- [ ] `npx prisma generate` run and committed to repo
- [ ] Seed script run on a staging copy first: `npm run db:seed`
- [ ] Production migration SQL applied (see `docs/go-live-checklist.md` §Production Migration SQL)
- [ ] Admin user created with OWNER role and correct credentials

### File Storage

- [ ] Vercel Blob add-on enabled (for employee photo uploads), **or**
- [ ] Cloudflare R2 bucket created and R2 env vars set (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`)
- [ ] Test file upload in staging: upload an employee photo → verify accessible

---

## Phase 2 — Security Verification

### Environment Variables

- [ ] `DATABASE_URL` — production connection string (not example placeholder)
- [ ] `AUTH_SECRET` — 32-byte fresh random value (`openssl rand -base64 32`)
- [ ] `AUTH_URL` — `https://hr.zysteel.com` (exact, no trailing slash)
- [ ] `CRON_SECRET` — 64-char fresh hex (`openssl rand -hex 32`)
- [ ] `NEXT_PUBLIC_APP_URL` — `https://hr.zysteel.com`
- [ ] `.env` file is NOT committed to git (verify with `git log --oneline -- .env`)
- [ ] `public/`, `prisma/fix-login.ts`, `prisma/production-migration.sql` NOT committed

### HTTP Security Headers

Run `curl -I https://hr.zysteel.com` and verify:

- [ ] `strict-transport-security: max-age=63072000; includeSubDomains; preload`
- [ ] `x-content-type-options: nosniff`
- [ ] `x-frame-options: SAMEORIGIN`
- [ ] `referrer-policy: strict-origin-when-cross-origin`
- [ ] `content-security-policy: default-src 'self' ...`
- [ ] No `x-powered-by` header in response

### Authentication & Access Control

- [ ] Unauthenticated user is redirected to `/login` on all protected routes
- [ ] `/uploads/photo.jpg` requires authentication (not publicly accessible)
- [ ] `/api/cron/*` endpoints return 401 without `x-cron-secret` header
- [ ] VIEWER role cannot access Payroll → Run Payroll (tested)
- [ ] SUPERVISOR cannot edit employees from another department (tested)
- [ ] Session cookie is `__Secure-better-auth.session_token` (HTTPS prefix) in production

### npm Audit

- [ ] `npm audit --audit-level=high` returns 0 high/critical vulnerabilities

---

## Phase 3 — Database Backup

### Before Deployment

- [ ] Full database dump taken from staging: `pg_dump $DATABASE_URL -Fc -f pre-golive.dump`
- [ ] Dump stored in S3/R2 with 90-day retention
- [ ] Restore verified on a test database: `pg_restore -d $TEST_DB pre-golive.dump`

### Ongoing Backup Schedule

- [ ] Neon PITR enabled (Pro tier: 30-day history)
- [ ] Weekly export to S3/R2 scheduled (GitHub Actions cron or cURL job)
- [ ] Backup restore drill scheduled (within 30 days of go-live)

### Backup Verification Command

```bash
pg_dump "$DATABASE_URL" -Fc -f "zysteel_hr_$(date +%Y%m%d).dump" && echo "Backup OK"
```

---

## Phase 4 — Rollback Procedure

### Application Rollback

```bash
# List deployments
vercel ls

# Roll back to previous deployment (immediate, ~30 seconds)
vercel rollback [previous-deployment-url]
```

### Database Rollback

```bash
# Restore from pre-go-live dump
pg_restore -d "$DATABASE_URL" --no-owner --clean --if-exists pre-golive.dump
```

### Schema Rollback (index-only changes)

```sql
-- Safe to run — non-destructive
DROP INDEX IF EXISTS "Employee_hireDate_idx";
DROP INDEX IF EXISTS "Employee_contractExpiry_idx";
DROP INDEX IF EXISTS "PayPeriod_payrollDate_idx";
```

### Decision Criteria for Rollback

Roll back immediately if any of these occur within the first 4 hours:
- Health endpoint returns 503 for more than 2 minutes
- Any user cannot log in
- Employee data is corrupted or missing
- Payroll calculations produce wrong values

---

## Phase 5 — User Training

### Training Sessions Required

- [ ] HR staff (HR_MANAGER, SUPERVISOR): 2-hour session covering HR, attendance, leave, payroll
- [ ] Production supervisors: 1-hour session covering production orders, machine monitoring
- [ ] Warehouse staff: 1-hour session covering inventory transactions
- [ ] Finance team: 1-hour session covering invoices, payments, expenses
- [ ] Purchasing team: 1-hour session covering PR → PO → receipt flow
- [ ] Sales team: 1-hour session covering quotation → SO → delivery flow

### Training Materials

- [ ] User Manual distributed (`docs/USER_MANUAL.md` or printed version)
- [ ] Quick Reference Card created for each role (1-page summary)
- [ ] IT support contact posted in system (Telegram group or email)

### Accounts Created

- [ ] All staff accounts created with correct roles before training
- [ ] Staff have logged in at least once and changed default passwords
- [ ] Portal accounts created for key customers and suppliers

---

## Phase 6 — Production Verification (Day of Go-Live)

### Pre-Launch (T-2 hours)

- [ ] Final database backup taken
- [ ] Staging environment smoke test passed (all P1 UAT scenarios)
- [ ] Support team notified and on standby
- [ ] Rollback procedure tested on staging

### Launch Sequence

1. [ ] Deploy latest `main` to Vercel production: `vercel --prod`
2. [ ] Verify `/api/health` returns `"status": "healthy"`
3. [ ] Login as OWNER → verify dashboard loads
4. [ ] Login as HR_MANAGER → verify employee list loads
5. [ ] Test creating a test employee → delete after verification
6. [ ] Login as SUPERVISOR → verify attendance grid loads for own department
7. [ ] Test file upload (employee photo) → verify URL accessible while logged in
8. [ ] Manually trigger cron job → verify Telegram notification received
9. [ ] Open `/factory/tv` → verify TV dashboard loads and auto-refreshes

### DNS Cutover (if applicable)

- [ ] TTL reduced to 60s at least 1 hour before cutover
- [ ] Old system set to read-only or maintenance mode
- [ ] Data migration completed and verified
- [ ] DNS record updated to point to Vercel
- [ ] Propagation verified: `nslookup hr.zysteel.com`

---

## Phase 7 — Post-Launch Monitoring

### First 24 Hours

- [ ] Health endpoint polled every 5 minutes (UptimeRobot / Pingdom configured)
- [ ] Vercel logs monitored for unhandled errors: `vercel logs --follow`
- [ ] Telegram daily report received next morning (07:00 local time)
- [ ] At least 5 users have logged in and performed normal operations
- [ ] Audit log shows expected activity (Admin → Audit Log)

### First Week

- [ ] Payroll run successfully for current period (if applicable)
- [ ] Inventory transactions recorded without errors
- [ ] No critical alarms in Smart Factory (or alarms are acknowledged)
- [ ] Cron jobs all executed on schedule (check Vercel cron logs)
- [ ] No security incidents reported

### Monitoring Tools

| Tool | What it monitors | Alert threshold |
|---|---|---|
| UptimeRobot (free) | `GET /api/health` → HTTP 200 | Alert if down >2 min |
| Vercel Analytics | Request volume, error rate | Alert if error rate >1% |
| Neon monitoring | DB connections, query latency | Alert if latency >500ms |
| Telegram bot | Cron job failures (sent in message) | Any missed job |
| Admin → System Health | DB, users, pending items | Manual check daily |

---

## Known Risks & Mitigations

| Risk | Impact | Mitigation | Status |
|---|---|---|---|
| Audit logging missing in 7 modules (inventory, sales, etc.) | Compliance gap | Planned for next sprint | Open |
| File uploads use Vercel Blob (replication to external bucket not automatic) | Data loss on provider outage | Enable R2 migration (env vars pre-wired) | Planned |
| AI chat has no per-user rate limiting | Budget overrun | Add Redis rate limiting before public launch | Open |
| `AUTH_URL` unset causes all logins to fail | Full outage | Verified in env checklist above | Mitigated |

---

## Sign-Off

| Role | Name | Date | Signature |
|---|---|---|---|
| IT Administrator | | | |
| HR Director | | | |
| Factory Manager | | | |
| Finance Manager | | | |
| CEO / Owner | | | |
