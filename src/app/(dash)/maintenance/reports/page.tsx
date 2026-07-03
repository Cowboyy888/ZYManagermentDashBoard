import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listWorkOrders, listSparePartUsages } from "@/actions/maintenance";
import { prisma } from "@/lib/db";
import { MaintenanceReports } from "./MaintenanceReports";

export const metadata: Metadata = { title: "Maintenance Reports" };

export default async function MaintenanceReportsPage() {
  const user = await requireUser();

  const [woResult, usageResult, machines] = await Promise.all([
    listWorkOrders({ days: 180, limit: 1000 }),
    listSparePartUsages({ limit: 500 }),
    prisma.machine.findMany({
      select: { id: true, code: true, name: true, type: true, status: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const workOrders = woResult.ok ? woResult.data.map((w) => ({
    id: w.id, woNumber: w.woNumber, type: w.type, priority: w.priority, status: w.status,
    title: w.title,
    machineId: w.machineId, machineCode: w.machine.code, machineName: w.machine.name,
    assignedToName: w.assignedTo?.nameEn ?? null,
    scheduledDate: (w.scheduledDate as Date).toISOString(),
    completedAt: w.completedAt?.toISOString() ?? null,
    downtimeMinutes: w.downtimeMinutes,
    laborHours: w.laborHours !== null ? Number(w.laborHours) : null,
    totalCostUsd: w.totalCostUsd !== null ? Number(w.totalCostUsd) : null,
    createdAt: w.createdAt.toISOString(),
  })) : [];

  const usages = usageResult.ok ? usageResult.data.map((u) => ({
    id: u.id, woNumber: u.workOrder.woNumber,
    machineCode: u.workOrder.machine.code, machineName: u.workOrder.machine.name,
    itemCode: u.item.itemCode ?? "", itemName: u.item.name,
    quantityUsed: Number(u.quantityUsed),
    totalCostUsd: u.totalCostUsd !== null ? Number(u.totalCostUsd) : null,
    createdAt: u.createdAt.toISOString(),
  })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Maintenance Reports</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Downtime, cost, PM compliance and equipment performance</p>
      </div>
      <MaintenanceReports
        workOrders={workOrders}
        usages={usages}
        machines={machines.map((m) => ({ id: m.id, code: m.code, name: m.name, type: m.type, status: m.status as string }))}
        canExport={can(user.role, "report.export")}
      />
    </div>
  );
}
