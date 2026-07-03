import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listSchedules } from "@/actions/maintenance";
import { prisma } from "@/lib/db";
import { SchedulesManager } from "./SchedulesManager";

export const metadata: Metadata = { title: "PM Schedules" };

export default async function SchedulesPage() {
  const user = await requireUser();

  const [result, machines, employees] = await Promise.all([
    listSchedules({ limit: 300 }),
    prisma.machine.findMany({
      where: { status: { not: "RETIRED" } },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, nameEn: true },
      orderBy: { nameEn: "asc" },
    }),
  ]);

  const schedules = result.ok ? result.data.map((s) => ({
    id: s.id, title: s.title, description: s.description, frequency: s.frequency,
    machineId: s.machineId, machineCode: s.machine.code, machineName: s.machine.name,
    assignedToId: s.assignedToId, assignedToName: s.assignedTo?.nameEn ?? null,
    nextDueDate: (s.nextDueDate as Date).toISOString(),
    lastCompletedAt: s.lastCompletedAt?.toISOString() ?? null,
    estimatedHours: s.estimatedHours !== null ? Number(s.estimatedHours) : null,
    active: s.active, workOrderCount: s._count.workOrders,
    createdBy: s.createdBy.name, createdAt: s.createdAt.toISOString(),
  })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>PM Schedules</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Preventive maintenance schedules and auto work order generation</p>
      </div>
      <SchedulesManager
        schedules={schedules}
        machines={machines}
        employees={employees}
        canWrite={can(user.role, "maintenance.write")}
      />
    </div>
  );
}
