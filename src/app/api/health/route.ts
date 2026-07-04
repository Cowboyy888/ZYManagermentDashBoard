import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Machine-readable health endpoint — used by Vercel, Pingdom, UptimeRobot, etc.
// Returns 200 when all checks pass, 503 when any critical check fails.
export async function GET() {
  const t0 = Date.now();
  let dbOk = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    // db unreachable — degraded, not throwing
  }

  const dbLatencyMs = Date.now() - t0;
  const status = dbOk ? "healthy" : "degraded";

  const envOk =
    !!process.env.DATABASE_URL &&
    !!process.env.AUTH_SECRET &&
    !!process.env.AUTH_URL &&
    !!process.env.CRON_SECRET;

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      version: "0.2.0",
      uptime: Math.floor(process.uptime()),
      checks: {
        database: { ok: dbOk, latencyMs: dbLatencyMs },
        env: { ok: envOk },
      },
    },
    { status: dbOk ? 200 : 503 }
  );
}
