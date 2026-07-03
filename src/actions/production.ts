"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../lib/db";
import { guard } from "../lib/auth/session";
import type { ActionResult } from "./employees";

// ── Machines ──────────────────────────────────────────────────────────────────

export async function listMachines() {
  try {
    await guard("production.read");
    const data = await prisma.machine.findMany({
      include: { factoryArea: { select: { id: true, name: true, code: true } } },
      orderBy: [{ factoryAreaId: "asc" }, { code: "asc" }],
    });
    return { ok: true as const, data };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

const MachineInput = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  type: z.string().min(1).max(60),
  factoryAreaId: z.coerce.number().int().positive().optional().nullable(),
  status: z.enum(["OPERATIONAL", "UNDER_MAINTENANCE", "RETIRED"]).default("OPERATIONAL"),
  purchaseDate: z.coerce.date().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export async function createMachine(raw: unknown): Promise<ActionResult<{ id: number }>> {
  try {
    const actor = await guard("production.manage");
    const p = MachineInput.safeParse(raw);
    if (!p.success) return { ok: false, error: p.error.errors[0].message };
    const m = await prisma.machine.create({
      data: {
        code: p.data.code, name: p.data.name, type: p.data.type, status: p.data.status,
        factoryAreaId: p.data.factoryAreaId ?? null,
        purchaseDate: p.data.purchaseDate ?? null,
        notes: p.data.notes ?? null,
      },
    });
    revalidatePath("/production/machines");
    void actor;
    return { ok: true, data: { id: m.id } };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function updateMachineStatus(id: number, status: "OPERATIONAL" | "UNDER_MAINTENANCE" | "RETIRED"): Promise<ActionResult<undefined>> {
  try {
    await guard("production.manage");
    await prisma.machine.update({ where: { id }, data: { status } });
    revalidatePath("/production/machines");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Wire inventory ────────────────────────────────────────────────────────────

export async function listWireInventory() {
  try {
    await guard("production.read");
    const data = await prisma.wireInventory.findMany({ orderBy: { receivedDate: "desc" } });
    return { ok: true as const, data };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

const WireInput = z.object({
  batchCode: z.string().min(1).max(50),
  wireDiameterMm: z.coerce.number().positive().max(50),
  weightKg: z.coerce.number().positive(),
  supplier: z.string().max(100).optional().nullable(),
  receivedDate: z.coerce.date(),
  notes: z.string().max(300).optional().nullable(),
});

export async function createWireBatch(raw: unknown): Promise<ActionResult<{ id: number }>> {
  try {
    await guard("production.write");
    const p = WireInput.safeParse(raw);
    if (!p.success) return { ok: false, error: p.error.errors[0].message };
    const w = await prisma.wireInventory.create({
      data: {
        batchCode: p.data.batchCode,
        wireDiameterMm: p.data.wireDiameterMm,
        weightKg: p.data.weightKg,
        remainingKg: p.data.weightKg,
        supplier: p.data.supplier ?? null,
        receivedDate: p.data.receivedDate,
        notes: p.data.notes ?? null,
      },
    });
    revalidatePath("/production/inventory");
    return { ok: true, data: { id: w.id } };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function updateWireRemaining(id: number, remainingKg: number): Promise<ActionResult<undefined>> {
  try {
    await guard("production.write");
    const wire = await prisma.wireInventory.findUnique({ where: { id }, select: { weightKg: true } });
    if (!wire) return { ok: false, error: "Wire batch not found" };
    if (remainingKg < 0 || remainingKg > Number(wire.weightKg)) return { ok: false, error: "Invalid remaining quantity" };
    await prisma.wireInventory.update({ where: { id }, data: { remainingKg } });
    revalidatePath("/production/inventory");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Mesh inventory ────────────────────────────────────────────────────────────

export async function listMeshInventory() {
  try {
    await guard("production.read");
    const data = await prisma.meshInventory.findMany({ orderBy: { sku: "asc" } });
    return { ok: true as const, data };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

const MeshSkuInput = z.object({
  sku: z.string().min(1).max(60),
  lengthM: z.coerce.number().positive(),
  widthM: z.coerce.number().positive(),
  wireDiameterMm: z.coerce.number().positive().max(50),
  gridSpacingMm: z.coerce.number().int().positive(),
  unitWeightKg: z.coerce.number().positive(),
  qtyInStock: z.coerce.number().int().min(0).default(0),
  notes: z.string().max(300).optional().nullable(),
});

export async function createMeshSku(raw: unknown): Promise<ActionResult<{ id: number }>> {
  try {
    await guard("production.manage");
    const p = MeshSkuInput.safeParse(raw);
    if (!p.success) return { ok: false, error: p.error.errors[0].message };
    const m = await prisma.meshInventory.create({
      data: {
        sku: p.data.sku, lengthM: p.data.lengthM, widthM: p.data.widthM,
        wireDiameterMm: p.data.wireDiameterMm, gridSpacingMm: p.data.gridSpacingMm,
        unitWeightKg: p.data.unitWeightKg, qtyInStock: p.data.qtyInStock,
        notes: p.data.notes ?? null,
      },
    });
    revalidatePath("/production/inventory");
    return { ok: true, data: { id: m.id } };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function adjustMeshStock(id: number, delta: number): Promise<ActionResult<undefined>> {
  try {
    await guard("production.write");
    await prisma.meshInventory.update({ where: { id }, data: { qtyInStock: { increment: delta } } });
    revalidatePath("/production/inventory");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Production orders ─────────────────────────────────────────────────────────

export async function listProductionOrders() {
  try {
    await guard("production.read");
    const data = await prisma.productionOrder.findMany({
      include: {
        machine: { select: { id: true, code: true, name: true } },
        supervisor: { select: { id: true, nameEn: true } },
        lines: { include: { mesh: { select: { sku: true, lengthM: true, widthM: true, wireDiameterMm: true, gridSpacingMm: true } } } },
      },
      orderBy: [{ status: "asc" }, { plannedDate: "desc" }],
      take: 200,
    });
    return { ok: true as const, data };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

const OrderLineInput = z.object({
  meshId: z.coerce.number().int().positive(),
  qtyOrdered: z.coerce.number().int().positive(),
});

const OrderInput = z.object({
  orderCode: z.string().min(1).max(30),
  customer: z.string().max(100).optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  machineId: z.coerce.number().int().positive().optional().nullable(),
  supervisorId: z.coerce.number().int().positive().optional().nullable(),
  plannedDate: z.coerce.date(),
  notes: z.string().max(500).optional().nullable(),
  lines: z.array(OrderLineInput).min(1),
});

export async function createProductionOrder(raw: unknown): Promise<ActionResult<{ id: number }>> {
  try {
    await guard("production.manage");
    const p = OrderInput.safeParse(raw);
    if (!p.success) return { ok: false, error: p.error.errors[0].message };
    const order = await prisma.productionOrder.create({
      data: {
        orderCode: p.data.orderCode,
        customer: p.data.customer ?? null,
        priority: p.data.priority,
        machineId: p.data.machineId ?? null,
        supervisorId: p.data.supervisorId ?? null,
        plannedDate: p.data.plannedDate,
        notes: p.data.notes ?? null,
        lines: { createMany: { data: p.data.lines.map((l) => ({ meshId: l.meshId as number, qtyOrdered: l.qtyOrdered as number })) } },
      },
    });
    revalidatePath("/production/orders");
    return { ok: true, data: { id: order.id } };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function updateOrderStatus(
  id: number,
  status: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
): Promise<ActionResult<undefined>> {
  try {
    await guard("production.manage");
    const data: Parameters<typeof prisma.productionOrder.update>[0]["data"] = { status };
    if (status === "COMPLETED") data.completedDate = new Date();
    await prisma.productionOrder.update({ where: { id }, data });
    revalidatePath("/production/orders");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function updateOrderLineQty(id: number, qtyProduced: number): Promise<ActionResult<undefined>> {
  try {
    await guard("production.write");
    await prisma.productionOrderLine.update({ where: { id }, data: { qtyProduced } });
    revalidatePath("/production/orders");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Daily production reports ──────────────────────────────────────────────────

export async function listDailyReports(params?: { days?: number; factoryAreaId?: number }) {
  try {
    const actor = await guard("production.read");
    const since = new Date();
    since.setDate(since.getDate() - (params?.days ?? 30));

    const areaFilter =
      actor.role === "SUPERVISOR" && actor.departmentId
        ? { factoryAreaId: actor.departmentId }
        : params?.factoryAreaId
        ? { factoryAreaId: params.factoryAreaId }
        : {};

    const data = await prisma.dailyProductionReport.findMany({
      where: { reportDate: { gte: since }, ...areaFilter },
      include: {
        factoryArea: { select: { id: true, name: true, code: true } },
        supervisor: { select: { id: true, nameEn: true } },
      },
      orderBy: [{ reportDate: "desc" }, { shift: "asc" }],
    });
    return { ok: true as const, data };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

const ReportInput = z.object({
  reportDate: z.coerce.date(),
  shift: z.enum(["MORNING", "AFTERNOON", "NIGHT"]),
  factoryAreaId: z.coerce.number().int().positive().optional().nullable(),
  supervisorId: z.coerce.number().int().positive().optional().nullable(),
  meshProducedKg: z.coerce.number().min(0),
  wireConsumedKg: z.coerce.number().min(0),
  headcount: z.coerce.number().int().min(0),
  downtimeMinutes: z.coerce.number().int().min(0).default(0),
  notes: z.string().max(500).optional().nullable(),
});

export async function upsertDailyReport(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await guard("production.write");
    const p = ReportInput.safeParse(raw);
    if (!p.success) return { ok: false, error: p.error.errors[0].message };

    const report = await prisma.dailyProductionReport.upsert({
      where: {
        reportDate_shift_factoryAreaId: {
          reportDate: p.data.reportDate,
          shift: p.data.shift,
          factoryAreaId: p.data.factoryAreaId ?? null,
        },
      },
      create: {
        reportDate: p.data.reportDate,
        shift: p.data.shift,
        factoryAreaId: p.data.factoryAreaId ?? null,
        supervisorId: p.data.supervisorId ?? null,
        meshProducedKg: p.data.meshProducedKg,
        wireConsumedKg: p.data.wireConsumedKg,
        headcount: p.data.headcount,
        downtimeMinutes: p.data.downtimeMinutes,
        notes: p.data.notes ?? null,
        createdById: actor.id,
      },
      update: {
        supervisorId: p.data.supervisorId ?? null,
        meshProducedKg: p.data.meshProducedKg,
        wireConsumedKg: p.data.wireConsumedKg,
        headcount: p.data.headcount,
        downtimeMinutes: p.data.downtimeMinutes,
        notes: p.data.notes ?? null,
      },
    });
    revalidatePath("/production/reports");
    return { ok: true, data: { id: report.id.toString() } };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Quality checks ────────────────────────────────────────────────────────────

export async function listQualityChecks() {
  try {
    await guard("production.read");
    const data = await prisma.qualityCheck.findMany({
      include: {
        order: { select: { id: true, orderCode: true } },
        inspectedBy: { select: { id: true, nameEn: true } },
      },
      orderBy: { checkDate: "desc" },
      take: 200,
    });
    return { ok: true as const, data };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

const QCInput = z.object({
  orderId: z.coerce.number().int().positive().optional().nullable(),
  inspectedById: z.coerce.number().int().positive().optional().nullable(),
  checkDate: z.coerce.date(),
  meshSku: z.string().max(60).optional().nullable(),
  sampleSize: z.coerce.number().int().positive(),
  defectCount: z.coerce.number().int().min(0),
  result: z.enum(["PASS", "FAIL", "REWORK"]),
  notes: z.string().max(500).optional().nullable(),
});

export async function createQualityCheck(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await guard("production.write");
    const p = QCInput.safeParse(raw);
    if (!p.success) return { ok: false, error: p.error.errors[0].message };
    if (p.data.defectCount > p.data.sampleSize) return { ok: false, error: "Defect count cannot exceed sample size" };
    const qc = await prisma.qualityCheck.create({
      data: {
        orderId: p.data.orderId ?? null,
        inspectedById: p.data.inspectedById ?? null,
        checkDate: p.data.checkDate,
        meshSku: p.data.meshSku ?? null,
        sampleSize: p.data.sampleSize,
        defectCount: p.data.defectCount,
        result: p.data.result,
        notes: p.data.notes ?? null,
      },
    });
    revalidatePath("/production/quality");
    return { ok: true, data: { id: qc.id.toString() } };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Maintenance logs ──────────────────────────────────────────────────────────

export async function listMaintenanceLogs(machineId?: number) {
  try {
    await guard("production.read");
    const data = await prisma.maintenanceLog.findMany({
      where: machineId ? { machineId } : {},
      include: {
        machine: { select: { id: true, code: true, name: true } },
        performedBy: { select: { id: true, nameEn: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 200,
    });
    return { ok: true as const, data };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

const MaintenanceInput = z.object({
  machineId: z.coerce.number().int().positive(),
  type: z.enum(["PREVENTIVE", "CORRECTIVE", "BREAKDOWN"]),
  performedById: z.coerce.number().int().positive().optional().nullable(),
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().optional().nullable(),
  downtimeMinutes: z.coerce.number().int().min(0).optional().nullable(),
  description: z.string().min(1).max(500),
  cost: z.coerce.number().min(0).optional().nullable(),
});

export async function createMaintenanceLog(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await guard("maintenance.write");
    const p = MaintenanceInput.safeParse(raw);
    if (!p.success) return { ok: false, error: p.error.errors[0].message };
    const log = await prisma.maintenanceLog.create({
      data: {
        machineId: p.data.machineId,
        type: p.data.type,
        performedById: p.data.performedById ?? null,
        startedAt: p.data.startedAt,
        completedAt: p.data.completedAt ?? null,
        downtimeMinutes: p.data.downtimeMinutes ?? null,
        description: p.data.description,
        cost: p.data.cost ?? null,
      },
    });
    revalidatePath("/production/maintenance");
    return { ok: true, data: { id: log.id.toString() } };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function completeMaintenanceLog(id: string, completedAt: Date): Promise<ActionResult<undefined>> {
  try {
    await guard("maintenance.write");
    const log = await prisma.maintenanceLog.findUnique({ where: { id: BigInt(id) }, select: { startedAt: true } });
    if (!log) return { ok: false, error: "Maintenance log not found" };
    const downtimeMinutes = Math.round((completedAt.getTime() - log.startedAt.getTime()) / 60000);
    await prisma.maintenanceLog.update({
      where: { id: BigInt(id) },
      data: { completedAt, downtimeMinutes },
    });
    revalidatePath("/production/maintenance");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Production dashboard summary ──────────────────────────────────────────────

export async function getProductionSummary() {
  try {
    await guard("production.read");

    const today      = new Date();
    const todayDate  = new Date(today.toISOString().slice(0, 10));
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const last30     = new Date(today); last30.setDate(today.getDate() - 29);
    const last7      = new Date(today); last7.setDate(today.getDate() - 6);

    const [
      todayOutput,
      monthlyOutput,
      ordersByStatus,
      machinesByStatus,
      activeOrders,
      recentReports,
      qcLast30,
      recentMaintenance,
      monthlyTrend,
    ] = await Promise.all([
      // Today's aggregate
      prisma.dailyProductionReport.aggregate({
        where: { reportDate: { equals: todayDate } },
        _sum: { meshProducedKg: true, wireConsumedKg: true, downtimeMinutes: true },
      }),
      // Monthly aggregate
      prisma.dailyProductionReport.aggregate({
        where: { reportDate: { gte: monthStart } },
        _sum: { meshProducedKg: true, wireConsumedKg: true, downtimeMinutes: true },
      }),
      // Orders by status
      prisma.productionOrder.groupBy({ by: ["status"], _count: { id: true } }),
      // Machines by status
      prisma.machine.groupBy({ by: ["status"], _count: { id: true } }),
      // Active orders with progress
      prisma.productionOrder.findMany({
        where: { status: "IN_PROGRESS" },
        include: {
          machine: { select: { code: true, name: true } },
          supervisor: { select: { nameEn: true } },
          lines: { select: { qtyOrdered: true, qtyProduced: true } },
        },
        orderBy: { plannedDate: "asc" },
        take: 10,
      }),
      // Recent shift reports (7 days)
      prisma.dailyProductionReport.findMany({
        where: { reportDate: { gte: last7 } },
        include: { factoryArea: { select: { name: true, code: true } }, supervisor: { select: { nameEn: true } } },
        orderBy: [{ reportDate: "desc" }, { shift: "asc" }],
        take: 21,
      }),
      // QC checks last 30 days for pass rate
      prisma.qualityCheck.findMany({
        where: { checkDate: { gte: last30 } },
        select: { result: true, sampleSize: true, defectCount: true },
      }),
      // Open maintenance (no completedAt)
      prisma.maintenanceLog.count({ where: { completedAt: null } }),
      // Monthly production trend (last 6 months, by day → aggregate in Node)
      prisma.dailyProductionReport.findMany({
        where: { reportDate: { gte: new Date(today.getFullYear(), today.getMonth() - 5, 1) } },
        select: { reportDate: true, meshProducedKg: true },
        orderBy: { reportDate: "asc" },
      }),
    ]);

    // Build monthly trend buckets
    const trendMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      trendMap[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
    }
    for (const r of monthlyTrend) {
      const k = `${r.reportDate.getFullYear()}-${String(r.reportDate.getMonth() + 1).padStart(2, "0")}`;
      if (k in trendMap) trendMap[k] += Number(r.meshProducedKg);
    }
    const productionTrend = Object.entries(trendMap).map(([month, kg]) => ({ month, kg: Math.round(kg * 10) / 10 }));

    // QC stats
    const passCount   = qcLast30.filter((c) => c.result === "PASS").length;
    const failCount   = qcLast30.filter((c) => c.result === "FAIL").length;
    const reworkCount = qcLast30.filter((c) => c.result === "REWORK").length;
    let totalSampled = 0, totalDefects = 0;
    for (const c of qcLast30) { totalSampled += c.sampleSize; totalDefects += c.defectCount; }
    const passRate = qcLast30.length > 0 ? Math.round((passCount / qcLast30.length) * 100) : null;
    const defectRate = totalSampled > 0 ? Math.round((totalDefects / totalSampled) * 1000) / 10 : null;

    const data = {
      today: {
        meshKg: Number(todayOutput._sum.meshProducedKg ?? 0),
        wireKg: Number(todayOutput._sum.wireConsumedKg ?? 0),
        downtimeMin: Number(todayOutput._sum.downtimeMinutes ?? 0),
      },
      monthly: {
        meshKg: Math.round(Number(monthlyOutput._sum.meshProducedKg ?? 0) * 10) / 10,
        wireKg: Math.round(Number(monthlyOutput._sum.wireConsumedKg ?? 0) * 10) / 10,
        downtimeMin: Number(monthlyOutput._sum.downtimeMinutes ?? 0),
      },
      ordersByStatus: ordersByStatus.map((r) => ({ status: r.status, count: r._count.id })),
      machinesByStatus: machinesByStatus.map((r) => ({ status: r.status, count: r._count.id })),
      activeOrders: activeOrders.map((o) => ({
        id: o.id,
        orderCode: o.orderCode,
        customer: o.customer,
        priority: o.priority,
        plannedDate: o.plannedDate.toISOString(),
        machine: o.machine,
        supervisor: o.supervisor,
        qtyOrdered: o.lines.reduce((s, l) => s + l.qtyOrdered, 0),
        qtyProduced: o.lines.reduce((s, l) => s + l.qtyProduced, 0),
      })),
      recentReports: recentReports.map((r) => ({
        id: r.id.toString(),
        reportDate: r.reportDate.toISOString(),
        shift: r.shift,
        meshKg: Number(r.meshProducedKg),
        wireKg: Number(r.wireConsumedKg),
        headcount: r.headcount,
        downtimeMin: r.downtimeMinutes,
        factoryArea: r.factoryArea,
        supervisor: r.supervisor,
      })),
      qc: { passCount, failCount, reworkCount, passRate, defectRate, total: qcLast30.length },
      openMaintenance: recentMaintenance,
      productionTrend,
    };

    return { ok: true as const, data };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function errMsg(e: unknown): string {
  if (e instanceof Error) {
    if (e.message === "Not authenticated") redirect("/login");
    if (e.name === "ForbiddenError") return "You do not have permission for this action.";
    return e.message;
  }
  return "Unexpected error";
}
