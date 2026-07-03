import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listWorkOrders } from "@/actions/maintenance";
import { prisma } from "@/lib/db";
import { WorkOrdersManager } from "./WorkOrdersManager";

export const metadata: Metadata = { title: "Work Orders" };

export default async function WorkOrdersPage() {
  const user = await requireUser();

  const [result, machines, employees, inventoryItems] = await Promise.all([
    listWorkOrders({ limit: 400 }),
    prisma.machine.findMany({
      where: { status: { not: "RETIRED" } },
      select: { id: true, code: true, name: true, status: true },
      orderBy: { code: "asc" },
    }),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, nameEn: true },
      orderBy: { nameEn: "asc" },
    }),
    prisma.inventoryItem.findMany({
      where: { status: "ACTIVE", currentStock: { gt: 0 } },
      select: { id: true, itemCode: true, name: true, unitOfMeasure: true, currentStock: true, unitCostUsd: true },
      orderBy: { name: "asc" },
      take: 300,
    }),
  ]);

  const workOrders = result.ok ? result.data.map((w) => ({
    id: w.id, woNumber: w.woNumber, type: w.type, priority: w.priority, status: w.status,
    title: w.title, description: w.description,
    machineId: w.machineId, machineCode: w.machine.code, machineName: w.machine.name,
    assignedToId: w.assignedToId, assignedToName: w.assignedTo?.nameEn ?? null,
    scheduleId: w.scheduleId, scheduleTitle: w.schedule?.title ?? null,
    scheduledDate: (w.scheduledDate as Date).toISOString(),
    startedAt: w.startedAt?.toISOString() ?? null,
    completedAt: w.completedAt?.toISOString() ?? null,
    downtimeMinutes: w.downtimeMinutes,
    laborHours: w.laborHours !== null ? Number(w.laborHours) : null,
    partsCostUsd: w.partsCostUsd !== null ? Number(w.partsCostUsd) : null,
    laborCostUsd: w.laborCostUsd !== null ? Number(w.laborCostUsd) : null,
    totalCostUsd: w.totalCostUsd !== null ? Number(w.totalCostUsd) : null,
    notes: w.notes,
    createdBy: w.createdBy.name,
    sparePartCount: w._count.sparePartUsages,
    createdAt: w.createdAt.toISOString(),
  })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Work Orders</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Create, assign and track maintenance work orders</p>
      </div>
      <WorkOrdersManager
        workOrders={workOrders}
        machines={machines.map((m) => ({ id: m.id, code: m.code, name: m.name, status: m.status as string }))}
        employees={employees}
        inventoryItems={inventoryItems.map((i) => ({
          id: i.id, itemCode: i.itemCode ?? "", name: i.name,
          unitOfMeasure: i.unitOfMeasure, currentStock: Number(i.currentStock),
          unitCostUsd: i.unitCostUsd ? Number(i.unitCostUsd) : null,
        }))}
        canWrite={can(user.role, "maintenance.write")}
        canManage={can(user.role, "maintenance.manage")}
      />
    </div>
  );
}
