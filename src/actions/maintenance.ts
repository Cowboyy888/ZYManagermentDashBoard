"use server";

import { prisma } from "@/lib/db";
import { guard } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { notifyRole } from "@/lib/notify";

// ─── helpers ─────────────────────────────────────────────────────────────────

function ok<T>(data: T) { return { ok: true as const, data }; }
function err(error: string) { return { ok: false as const, error }; }
function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

// ─── Auto-number generators ──────────────────────────────────────────────────

async function nextWONumber() {
  const now = new Date();
  const prefix = `WO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-`;
  const last = await prisma.workOrder.findFirst({
    where: { woNumber: { startsWith: prefix } },
    orderBy: { woNumber: "desc" },
    select: { woNumber: true },
  });
  const seq = last ? (parseInt(last.woNumber.slice(-4)) + 1) : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

// ─── Asset / Machine management ──────────────────────────────────────────────

export async function listAssets(opts: { status?: string; limit?: number } = {}) {
  try {
    await guard("maintenance.read");
    const { status, limit = 200 } = opts;
    const data = await prisma.machine.findMany({
      where: status ? { status: status as "OPERATIONAL" | "UNDER_MAINTENANCE" | "OFFLINE" | "RETIRED" } : {},
      include: {
        factoryArea: { select: { id: true, name: true, code: true } },
        assignedTechnician: { select: { id: true, nameEn: true } },
        _count: { select: { workOrders: true, maintenanceSchedules: true } },
      },
      orderBy: { code: "asc" },
      take: limit,
    });
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

export async function updateAsset(raw: {
  id: number; brand?: string | null; machineModel?: string | null; serialNumber?: string | null;
  installationDate?: string | null; warrantyExpiry?: string | null;
  assignedTechnicianId?: number | null; status?: string; notes?: string | null;
  type?: string; capacityKgPerShift?: number | null;
}) {
  try {
    await guard("maintenance.manage");
    const updated = await prisma.machine.update({
      where: { id: raw.id },
      data: {
        brand: raw.brand ?? undefined,
        machineModel: raw.machineModel ?? undefined,
        serialNumber: raw.serialNumber ?? undefined,
        installationDate: raw.installationDate ? new Date(raw.installationDate) : raw.installationDate === null ? null : undefined,
        warrantyExpiry: raw.warrantyExpiry ? new Date(raw.warrantyExpiry) : raw.warrantyExpiry === null ? null : undefined,
        assignedTechnicianId: raw.assignedTechnicianId !== undefined ? raw.assignedTechnicianId : undefined,
        status: raw.status as "OPERATIONAL" | "UNDER_MAINTENANCE" | "OFFLINE" | "RETIRED" | undefined,
        notes: raw.notes ?? undefined,
        type: raw.type ?? undefined,
        capacityKgPerShift: raw.capacityKgPerShift !== undefined ? raw.capacityKgPerShift : undefined,
      },
    });
    revalidatePath("/maintenance/assets");
    return ok(updated);
  } catch (e) { return err(errMsg(e)); }
}

// ─── Work Orders ─────────────────────────────────────────────────────────────

export async function listWorkOrders(opts: {
  status?: string; type?: string; machineId?: number; limit?: number; days?: number;
} = {}) {
  try {
    await guard("maintenance.read");
    const { status, type, machineId, limit = 300, days } = opts;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (machineId) where.machineId = machineId;
    if (days) where.createdAt = { gte: new Date(Date.now() - days * 86_400_000) };

    const data = await prisma.workOrder.findMany({
      where,
      include: {
        machine: { select: { id: true, code: true, name: true, factoryAreaId: true } },
        assignedTo: { select: { id: true, nameEn: true } },
        schedule: { select: { id: true, title: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { sparePartUsages: true } },
      },
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "desc" }],
      take: limit,
    });
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

export async function createWorkOrder(raw: {
  machineId: number; type: string; priority: string; title: string; description?: string | null;
  assignedToId?: number | null; scheduleId?: number | null;
  scheduledDate: string; laborHours?: number | null; laborCostUsd?: number | null; notes?: string | null;
}) {
  try {
    const session = await guard("maintenance.write");
    const woNumber = await nextWONumber();
    const wo = await prisma.workOrder.create({
      data: {
        woNumber,
        machineId: raw.machineId,
        type: raw.type,
        priority: raw.priority,
        title: raw.title,
        description: raw.description ?? null,
        assignedToId: raw.assignedToId ?? null,
        scheduleId: raw.scheduleId ?? null,
        scheduledDate: new Date(raw.scheduledDate),
        laborHours: raw.laborHours ?? null,
        laborCostUsd: raw.laborCostUsd ?? null,
        notes: raw.notes ?? null,
        createdById: session.id,
      },
      include: {
        machine: { select: { id: true, code: true, name: true } },
        assignedTo: { select: { id: true, nameEn: true } },
      },
    });
    revalidatePath("/maintenance/work-orders");
    // Workflow: breakdown WO → notify maintenance managers
    if (raw.type === "BREAKDOWN") {
      void notifyRole(["OWNER", "HR_MANAGER"], {
        title: `Machine breakdown: ${wo.machine.name}`,
        body: `Work order ${wo.woNumber} raised for machine ${wo.machine.code} — BREAKDOWN. Priority: ${raw.priority}.`,
        level: "critical", module: "maintenance", href: `/maintenance/work-orders`,
      }, { excludeUserId: session.id }).catch(console.error);
    }
    return ok(wo);
  } catch (e) { return err(errMsg(e)); }
}

export async function updateWorkOrderStatus(raw: {
  id: number; status: string; downtimeMinutes?: number | null;
  laborHours?: number | null; laborCostUsd?: number | null; notes?: string | null;
}) {
  try {
    await guard("maintenance.write");
    const now = new Date();
    const updateData: Record<string, unknown> = { status: raw.status, updatedAt: now };
    if (raw.status === "IN_PROGRESS") updateData.startedAt = now;
    if (raw.status === "COMPLETED") {
      updateData.completedAt = now;
      if (raw.downtimeMinutes != null) updateData.downtimeMinutes = raw.downtimeMinutes;
      if (raw.laborHours != null) updateData.laborHours = raw.laborHours;
      if (raw.laborCostUsd != null) updateData.laborCostUsd = raw.laborCostUsd;
    }
    if (raw.notes != null) updateData.notes = raw.notes;

    // Also update Machine status based on WO status
    const wo = await prisma.workOrder.findUnique({ where: { id: raw.id }, select: { machineId: true, type: true } });
    if (wo) {
      if (raw.status === "IN_PROGRESS" && (wo.type === "BREAKDOWN" || wo.type === "CORRECTIVE")) {
        await prisma.machine.update({ where: { id: wo.machineId }, data: { status: "UNDER_MAINTENANCE" } });
      }
      if (raw.status === "COMPLETED" || raw.status === "CANCELLED") {
        // Check if any other open WOs exist for this machine before restoring
        const openCount = await prisma.workOrder.count({
          where: { machineId: wo.machineId, status: { in: ["OPEN", "IN_PROGRESS"] }, id: { not: raw.id } }
        });
        if (openCount === 0) {
          await prisma.machine.update({ where: { id: wo.machineId }, data: { status: "OPERATIONAL" } });
        }
      }
    }

    const updated = await prisma.workOrder.update({
      where: { id: raw.id },
      data: updateData,
      include: { machine: { select: { id: true, code: true, name: true } } },
    });

    // Compute total cost
    const parts = await prisma.sparePartUsage.aggregate({
      where: { workOrderId: raw.id },
      _sum: { totalCostUsd: true },
    });
    const partsCost = parts._sum.totalCostUsd ? Number(parts._sum.totalCostUsd) : 0;
    const laborCost = raw.laborCostUsd ?? (updated.laborCostUsd ? Number(updated.laborCostUsd) : 0);
    await prisma.workOrder.update({
      where: { id: raw.id },
      data: { partsCostUsd: partsCost, totalCostUsd: partsCost + laborCost },
    });

    revalidatePath("/maintenance/work-orders");
    return ok(updated);
  } catch (e) { return err(errMsg(e)); }
}

// ─── Spare Parts Usage ───────────────────────────────────────────────────────

export async function addSparePartUsage(raw: {
  workOrderId: number; itemId: number; quantityUsed: number; notes?: string | null;
}) {
  try {
    const session = await guard("maintenance.write");
    const item = await prisma.inventoryItem.findUnique({
      where: { id: raw.itemId },
      select: { currentStock: true, unitCostUsd: true, name: true, itemCode: true },
    });
    if (!item) return err("Item not found");
    if (Number(item.currentStock) < raw.quantityUsed) return err(`Insufficient stock (${item.currentStock} available)`);

    const unitCost = item.unitCostUsd ? Number(item.unitCostUsd) : 0;
    const totalCost = unitCost * raw.quantityUsed;

    const usage = await prisma.$transaction(async (tx) => {
      const usage = await tx.sparePartUsage.create({
        data: {
          workOrderId: raw.workOrderId,
          itemId: raw.itemId,
          quantityUsed: raw.quantityUsed,
          unitCostUsd: unitCost,
          totalCostUsd: totalCost,
          notes: raw.notes ?? null,
        },
        include: { item: { select: { id: true, itemCode: true, name: true, unitOfMeasure: true } } },
      });
      const newStock = Number(item.currentStock) - raw.quantityUsed;
      await tx.inventoryItem.update({ where: { id: raw.itemId }, data: { currentStock: newStock, updatedAt: new Date() } });
      await tx.stockTransaction.create({
        data: {
          type: "STOCK_OUT",
          itemId: raw.itemId,
          quantity: raw.quantityUsed,
          unitCostUsd: unitCost,
          balanceAfter: newStock,
          refNumber: `WO-${raw.workOrderId}`,
          note: `Spare part used in work order`,
          createdById: session.id,
        },
      });
      // Recompute WO parts cost
      const parts = await tx.sparePartUsage.aggregate({
        where: { workOrderId: raw.workOrderId },
        _sum: { totalCostUsd: true },
      });
      const wo = await tx.workOrder.findUnique({ where: { id: raw.workOrderId }, select: { laborCostUsd: true } });
      const laborCost = wo?.laborCostUsd ? Number(wo.laborCostUsd) : 0;
      const partsCost = parts._sum.totalCostUsd ? Number(parts._sum.totalCostUsd) : 0;
      await tx.workOrder.update({
        where: { id: raw.workOrderId },
        data: { partsCostUsd: partsCost, totalCostUsd: partsCost + laborCost },
      });
      return usage;
    });

    revalidatePath("/maintenance/work-orders");
    revalidatePath("/inventory");
    return ok(usage);
  } catch (e) { return err(errMsg(e)); }
}

export async function listSparePartUsages(opts: { workOrderId?: number; itemId?: number; limit?: number } = {}) {
  try {
    await guard("maintenance.read");
    const { workOrderId, itemId, limit = 200 } = opts;
    const where: Record<string, unknown> = {};
    if (workOrderId) where.workOrderId = workOrderId;
    if (itemId) where.itemId = itemId;
    const data = await prisma.sparePartUsage.findMany({
      where,
      include: {
        item: { select: { id: true, itemCode: true, name: true, unitOfMeasure: true, currentStock: true } },
        workOrder: { select: { id: true, woNumber: true, title: true, machine: { select: { code: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

// ─── Preventive Maintenance Schedules ────────────────────────────────────────

export async function listSchedules(opts: { machineId?: number; active?: boolean; limit?: number } = {}) {
  try {
    await guard("maintenance.read");
    const { machineId, active, limit = 200 } = opts;
    const where: Record<string, unknown> = {};
    if (machineId) where.machineId = machineId;
    if (active !== undefined) where.active = active;
    const data = await prisma.maintenanceSchedule.findMany({
      where,
      include: {
        machine: { select: { id: true, code: true, name: true } },
        assignedTo: { select: { id: true, nameEn: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { workOrders: true } },
      },
      orderBy: { nextDueDate: "asc" },
      take: limit,
    });
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

export async function createSchedule(raw: {
  machineId: number; title: string; description?: string | null; frequency: string;
  nextDueDate: string; assignedToId?: number | null; estimatedHours?: number | null;
}) {
  try {
    const session = await guard("maintenance.write");
    const schedule = await prisma.maintenanceSchedule.create({
      data: {
        machineId: raw.machineId,
        title: raw.title,
        description: raw.description ?? null,
        frequency: raw.frequency,
        nextDueDate: new Date(raw.nextDueDate),
        assignedToId: raw.assignedToId ?? null,
        estimatedHours: raw.estimatedHours ?? null,
        createdById: session.id,
      },
      include: {
        machine: { select: { id: true, code: true, name: true } },
        assignedTo: { select: { id: true, nameEn: true } },
      },
    });
    revalidatePath("/maintenance/schedules");
    return ok(schedule);
  } catch (e) { return err(errMsg(e)); }
}

export async function updateSchedule(raw: {
  id: number; title?: string; description?: string | null; frequency?: string;
  active?: boolean; nextDueDate?: string; assignedToId?: number | null; estimatedHours?: number | null;
}) {
  try {
    await guard("maintenance.write");
    const updated = await prisma.maintenanceSchedule.update({
      where: { id: raw.id },
      data: {
        title: raw.title !== undefined ? raw.title : undefined,
        description: raw.description !== undefined ? raw.description : undefined,
        frequency: raw.frequency !== undefined ? (raw.frequency as "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY") : undefined,
        active: raw.active !== undefined ? raw.active : undefined,
        nextDueDate: raw.nextDueDate ? new Date(raw.nextDueDate) : undefined,
        assignedToId: raw.assignedToId !== undefined ? raw.assignedToId : undefined,
        estimatedHours: raw.estimatedHours !== undefined ? raw.estimatedHours : undefined,
      },
    });
    revalidatePath("/maintenance/schedules");
    return ok(updated);
  } catch (e) { return err(errMsg(e)); }
}

export async function generateWorkOrderFromSchedule(scheduleId: number) {
  try {
    const session = await guard("maintenance.write");
    const schedule = await prisma.maintenanceSchedule.findUnique({
      where: { id: scheduleId },
      include: { machine: { select: { code: true, name: true } } },
    });
    if (!schedule) return err("Schedule not found");
    if (!schedule.active) return err("Schedule is inactive");

    const woNumber = await nextWONumber();
    const wo = await prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.create({
        data: {
          woNumber,
          machineId: schedule.machineId,
          type: "PREVENTIVE",
          priority: "MEDIUM",
          title: schedule.title,
          description: schedule.description ?? null,
          assignedToId: schedule.assignedToId ?? null,
          scheduleId: scheduleId,
          scheduledDate: schedule.nextDueDate,
          laborHours: schedule.estimatedHours ?? null,
          createdById: session.id,
        },
      });
      // Advance the next due date based on frequency
      const next = new Date(schedule.nextDueDate);
      switch (schedule.frequency) {
        case "DAILY":     next.setDate(next.getDate() + 1); break;
        case "WEEKLY":    next.setDate(next.getDate() + 7); break;
        case "MONTHLY":   next.setMonth(next.getMonth() + 1); break;
        case "QUARTERLY": next.setMonth(next.getMonth() + 3); break;
        case "YEARLY":    next.setFullYear(next.getFullYear() + 1); break;
      }
      await tx.maintenanceSchedule.update({
        where: { id: scheduleId },
        data: { nextDueDate: next, lastCompletedAt: new Date() },
      });
      return wo;
    });

    revalidatePath("/maintenance/schedules");
    revalidatePath("/maintenance/work-orders");
    return ok(wo);
  } catch (e) { return err(errMsg(e)); }
}

// ─── Dashboard summary ───────────────────────────────────────────────────────

export async function getMaintenanceSummary() {
  try {
    await guard("maintenance.read");
    const today     = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const in7days   = new Date(todayDate); in7days.setDate(todayDate.getDate() + 7);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const last6mo   = new Date(today.getFullYear(), today.getMonth() - 5, 1);

    const [
      machinesByStatus,
      openWOs,
      overdueWOs,
      dueThisWeek,
      monthCostAgg,
      recentWOs,
      downtimeThisMonth,
      last6moWOs,
    ] = await Promise.all([
      prisma.machine.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.workOrder.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      prisma.workOrder.count({
        where: { status: { in: ["OPEN", "IN_PROGRESS"] }, scheduledDate: { lt: todayDate } }
      }),
      prisma.maintenanceSchedule.count({
        where: { active: true, nextDueDate: { lte: in7days } }
      }),
      prisma.workOrder.aggregate({
        where: { createdAt: { gte: monthStart }, status: "COMPLETED" },
        _sum: { totalCostUsd: true },
      }),
      prisma.workOrder.findMany({
        where: {},
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          machine: { select: { code: true, name: true } },
          assignedTo: { select: { nameEn: true } },
        },
      }),
      prisma.workOrder.aggregate({
        where: { createdAt: { gte: monthStart }, downtimeMinutes: { not: null } },
        _sum: { downtimeMinutes: true },
      }),
      prisma.workOrder.findMany({
        where: { createdAt: { gte: last6mo } },
        select: { createdAt: true, status: true, type: true, totalCostUsd: true },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const r of machinesByStatus) statusMap[r.status] = r._count.id;
    const totalMachines  = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const operational    = statusMap["OPERATIONAL"] ?? 0;
    const underMaintenance = statusMap["UNDER_MAINTENANCE"] ?? 0;
    const offline        = statusMap["OFFLINE"] ?? 0;
    const availability   = totalMachines > 0 ? Math.round((operational / totalMachines) * 100) : 0;

    // Monthly trend for last 6 months
    const trendMap: Record<string, { total: number; cost: number; preventive: number; corrective: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      trendMap[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = { total: 0, cost: 0, preventive: 0, corrective: 0 };
    }
    for (const wo of last6moWOs) {
      const k = `${wo.createdAt.getFullYear()}-${String(wo.createdAt.getMonth() + 1).padStart(2, "0")}`;
      if (k in trendMap) {
        trendMap[k].total++;
        trendMap[k].cost += wo.totalCostUsd ? Number(wo.totalCostUsd) : 0;
        if (wo.type === "PREVENTIVE") trendMap[k].preventive++;
        else trendMap[k].corrective++;
      }
    }
    const monthlyTrend = Object.entries(trendMap).map(([month, v]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      ...v,
    }));

    // WO status breakdown
    const woByStatus = await prisma.workOrder.groupBy({ by: ["status"], _count: { id: true } });

    return ok({
      totalMachines, operational, underMaintenance, offline,
      availability,
      openWOs, overdueWOs, dueThisWeek,
      monthlyCostUsd: monthCostAgg._sum.totalCostUsd ? Number(monthCostAgg._sum.totalCostUsd) : 0,
      downtimeThisMonthMin: downtimeThisMonth._sum.downtimeMinutes ?? 0,
      monthlyTrend,
      woByStatus: woByStatus.map((r) => ({ status: r.status, count: r._count.id })),
      recentWOs: recentWOs.map((w) => ({
        id: w.id, woNumber: w.woNumber, type: w.type, priority: w.priority, status: w.status,
        title: w.title, machineName: w.machine.name, machineCode: w.machine.code,
        assignedToName: w.assignedTo?.nameEn ?? null,
        scheduledDate: (w.scheduledDate as Date).toISOString(),
        completedAt: w.completedAt?.toISOString() ?? null,
      })),
    });
  } catch (e) { return err(errMsg(e)); }
}

export async function getMaintenanceExecutiveSummary() {
  try {
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const in7days   = new Date(todayDate); in7days.setDate(todayDate.getDate() + 7);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [machinesByStatus, openWOs, dueThisWeek, monthlyCostAgg] = await Promise.all([
      prisma.machine.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.workOrder.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      prisma.maintenanceSchedule.count({ where: { active: true, nextDueDate: { lte: in7days } } }),
      prisma.workOrder.aggregate({
        where: { createdAt: { gte: monthStart }, status: "COMPLETED" },
        _sum: { totalCostUsd: true },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const r of machinesByStatus) statusMap[r.status] = r._count.id;
    const total = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const availability = total > 0 ? Math.round(((statusMap["OPERATIONAL"] ?? 0) / total) * 100) : 0;

    return ok({
      availability,
      openWOs,
      dueThisWeek,
      monthlyCostUsd: monthlyCostAgg._sum.totalCostUsd ? Number(monthlyCostAgg._sum.totalCostUsd) : 0,
    });
  } catch (e) { return err(errMsg(e)); }
}
