# ZY Steel HR Dashboard — Deployment Guide

**Version:** 0.2.0 · **Platform:** Vercel + Neon PostgreSQL

---

## 1. Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 20+ | For local build/seed only |
| PostgreSQL 15+ | Neon serverless recommended |
| Vercel account | Free tier sufficient for staging |
| Domain name | e.g. `hr.zysteel.com` |

---

## 2. Environment Variables

Copy `.env.example` to `.env` for local dev. In Vercel, set all under **Project Settings → Environment Variables**.

### Required

| Variable | Value | How to generate |
|---|---|---|
| `DATABASE_URL` | `postgresql://...` | Neon dashboard → Connection string (pooled) |
| `AUTH_SECRET` | 32-byte base64 | `openssl rand -base64 32` |
| `AUTH_URL` | `https://hr.zysteel.com` | Your production domain, no trailing slash |
| `CRON_SECRET` | 64-char hex | `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | `https://hr.zysteel.com` | Same as AUTH_URL |

### Optional but Recommended

| Variable | Purpose |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Daily automated reports |
| `TELEGRAM_CHAT_ID` | HR management channel |
| `ANTHROPIC_API_KEY` | AI assistant features |
| `NEXT_PUBLIC_AUTH_URL` | Auth client base URL (defaults to AUTH_URL) |

### Storage (for document uploads)

| Variable | Notes |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET` | Bucket name (e.g. `zysteel-documents`) |

If R2 vars are absent, file uploads fall back to Vercel Blob (requires Vercel Blob add-on).

---

## 3. Database Setup

### Initial Setup

```bash
# 1. Create Neon project at neon.tech
# 2. Copy the pooled connection string into DATABASE_URL

# 3. Push the schema (no migration history needed)
npx prisma db push

# 4. Generate Prisma client
npx prisma generate

# 5. Seed reference data (positions, departments, factory areas)
npm run db:seed
```

### Schema Changes

```bash
# After editing prisma/schema.prisma:
npx prisma db push        # push changes
npx prisma generate       # regenerate client

# NEVER run: prisma migrate dev (in production)
# NEVER run: prisma migrate reset (destroys all data)
```

### Connection Strings

Use the **pooled** connection string from Neon for the production app (serverless-compatible). Use the **direct** connection string only for `prisma db push` and seed operations.

```
# Production app (.env in Vercel):
DATABASE_URL=postgresql://user:pass@ep-xxx.pooled.us-east-2.aws.neon.tech/zysteel?sslmode=require

# Schema pushes (run locally or in CI only):
DIRECT_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/zysteel?sslmode=require
```

---

## 4. Vercel Deployment

### First Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Link project
vercel link

# Set all env vars (or use Vercel dashboard)
vercel env add DATABASE_URL
vercel env add AUTH_SECRET
vercel env add AUTH_URL
vercel env add CRON_SECRET
vercel env add NEXT_PUBLIC_APP_URL

# Deploy to production
vercel --prod
```

### Subsequent Deployments

```bash
# Push to GitHub → Vercel auto-deploys from main branch
git push origin main

# Or manual:
vercel --prod
```

### Cron Jobs (Vercel)

Add to `vercel.json` (already included in project):

```json
{
  "crons": [
    { "path": "/api/cron/daily-report",    "schedule": "0 0 * * *"  },
    { "path": "/api/cron/contract-expiry", "schedule": "0 1 * * *"  },
    { "path": "/api/cron/low-stock",       "schedule": "0 1 30 * *" },
    { "path": "/api/cron/maintenance-due", "schedule": "0 2 * * *"  },
    { "path": "/api/cron/payroll-reminder","schedule": "0 2 25 * *" }
  ]
}
```

Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically.

---

## 5. Health Check

The app exposes a machine-readable health endpoint:

```
GET /api/health
```

Response (200 healthy / 503 degraded):
```json
{
  "status": "healthy",
  "timestamp": "2026-07-04T06:00:00.000Z",
  "version": "0.2.0",
  "uptime": 3600,
  "checks": {
    "database": { "ok": true, "latencyMs": 12 },
    "env": { "ok": true }
  }
}
```

Configure your monitoring tool (UptimeRobot, Pingdom, Vercel Checks) to poll `GET /api/health` every 1–5 minutes. Alert on non-200 responses.

---

## 6. Custom Domain

1. In Vercel dashboard → **Project → Settings → Domains** → Add `hr.zysteel.com`
2. Add the CNAME/A record provided by Vercel to your DNS provider
3. Vercel provisions a TLS certificate automatically (Let's Encrypt)
4. Update `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to `https://hr.zysteel.com`
5. Redeploy: `vercel --prod`

---

## 7. Backup Strategy

### Database Backups

Neon automatically takes point-in-time backups (PITR):
- **Free tier:** 7-day history
- **Pro tier:** 30-day history, branching for zero-downtime restores

Manual export (run on a schedule via cron or GitHub Actions):

```bash
pg_dump "$DATABASE_URL" \
  --no-owner --no-acl \
  -Fc -f "backup-$(date +%Y%m%d-%H%M%S).dump"
```

Store dumps in S3 or R2 with 90-day retention.

### File Backups

Employee photos in Vercel Blob/R2 are replicated by the provider. For disaster recovery, periodically export an inventory:

```bash
# R2 inventory via wrangler CLI
wrangler r2 object list zysteel-documents > r2-inventory.txt
```

---

## 8. Build & Rollback

```bash
# View deployment history
vercel ls

# Rollback to a previous deployment
vercel rollback [deployment-url]

# Local production build test
npm run build
npm start
```

---

## 9. Staging Environment

Create a separate Vercel project (`zysteel-hr-staging`) linked to the same GitHub repo but deploying from a `staging` branch. Use a separate Neon database branch:

```bash
# Create staging DB branch in Neon dashboard
# Or via CLI:
neonctl branch create --name staging --project-id <id>
```

Set `AUTH_URL=https://staging-hr.zysteel.com` and a different `AUTH_SECRET` for staging.

---

## 10. Security Checklist

- [ ] `.env` is in `.gitignore` — never committed
- [ ] `public/`, `prisma/fix-login.ts`, `prisma/production-migration.sql` not committed
- [ ] `AUTH_SECRET` is a fresh 32-byte value (not the example placeholder)
- [ ] `CRON_SECRET` is a fresh 64-char hex (not the example placeholder)
- [ ] Production domain uses HTTPS (verified by Vercel TLS)
- [ ] Security headers verified: `curl -I https://hr.zysteel.com` should show `strict-transport-security`, `x-content-type-options`, `x-frame-options`
- [ ] RBAC: initial admin user has OWNER role; other users have least-privilege roles
- [ ] Telegram bot token stored in env, not in code
