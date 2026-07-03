import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { listDailyReports } from "@/actions/production";
import { ReportsManager } from "./ReportsManager";

export const metadata: Metadata = { title: "Daily Production Reports" };

export default async function ReportsPage() {
  const user = await requireUser();

  const [result, factoryAreas, supervisors] = await Promise.all([
    listDailyReports({ days: 30 }),
    prisma.factoryArea.findMany({ orderBy: { code: "asc" } }),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, nameEn: true },
      orderBy: { nameEn: "asc" },
    }),
  ]);

  if (!result.ok) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Daily Reports</h1>
        <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>
          {result.error}
        </div>
      </div>
    );
  }

  const reports = result.data.map((r) => ({
    id: r.id.toString(),
    reportDate: r.reportDate.toISOString(),
    shift: r.shift,
    meshProducedKg: Number(r.meshProducedKg),
    wireConsumedKg: Number(r.wireConsumedKg),
    headcount: r.headcount,
    downtimeMinutes: r.downtimeMinutes,
    notes: r.notes,
    factoryArea: r.factoryArea,
    supervisor: r.supervisor,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Daily Reports</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Log shift production — mesh output, wire consumed, headcount</p>
      </div>
      <ReportsManager
        reports={reports}
        factoryAreas={factoryAreas}
        supervisors={supervisors}
        canWrite={can(user.role, "production.write")}
        actorDeptId={user.departmentId}
      />
    </div>
  );
}
