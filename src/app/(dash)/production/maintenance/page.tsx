import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { listMaintenanceLogs, listMachines } from "@/actions/production";
import { MaintenanceManager } from "./MaintenanceManager";

export const metadata: Metadata = { title: "Maintenance" };

export default async function MaintenancePage() {
  const user = await requireUser();

  const [logsResult, machinesResult, employees] = await Promise.all([
    listMaintenanceLogs(),
    listMachines(),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, nameEn: true },
      orderBy: { nameEn: "asc" },
    }),
  ]);

  if (!logsResult.ok) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Maintenance</h1>
        <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>
          {logsResult.error}
        </div>
      </div>
    );
  }

  const logs = logsResult.data.map((l) => ({
    id: l.id.toString(),
    machineId: l.machineId,
    type: l.type as string,
    startedAt: l.startedAt.toISOString(),
    completedAt: l.completedAt ? l.completedAt.toISOString() : null,
    downtimeMinutes: l.downtimeMinutes,
    description: l.description,
    cost: l.cost !== null ? Number(l.cost) : null,
    machine: l.machine,
    performedBy: l.performedBy,
    createdAt: l.createdAt.toISOString(),
  }));

  const machines = machinesResult.ok
    ? machinesResult.data.map((m) => ({ id: m.id, code: m.code, name: m.name, status: m.status as string }))
    : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Maintenance</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Log and track machine maintenance events</p>
      </div>
      <MaintenanceManager
        logs={logs}
        machines={machines}
        employees={employees}
        canWrite={can(user.role, "maintenance.write")}
      />
    </div>
  );
}
