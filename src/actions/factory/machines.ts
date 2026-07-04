"use server";
import { prisma } from "@/lib/db";
import { guard } from "@/lib/auth/session";

type AR<T> = { ok: true; data: T } | { ok: false; error: string };
function ok<T>(data: T): AR<T> { return { ok: true, data }; }
function err(e: unknown): AR<never> { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }

export async function getMachineMetrics() {
  try {
    await guard("factory.view");
    const machines = await prisma.machine.findMany({
      include: {
        factoryArea: { select: { name: true, code: true } },
        metric: {
          include: { operator: { select: { nameEn: true } } },
        },
        alarms: { where: { status: "ACTIVE" }, select: { id: true, alarmType: true, severity: true, title: true } },
        workOrders: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, select: { id: true, priority: true, title: true } },
      },
      orderBy: [{ factoryAreaId: "asc" }, { code: "asc" }],
    });

    return ok(machines.map(m => ({
      id: m.id,
      code: m.code,
      name: m.name,
      type: m.type,
      status: m.status,
      capacityKgPerShift: m.capacityKgPerShift ? Number(m.capacityKgPerShift) : null,
      factoryArea: m.factoryArea,
      metric: m.metric ? {
        isRunning: m.metric.isRunning,
        speedRpm: m.metric.speedRpm ? Number(m.metric.speedRpm) : null,
        outputCount: m.metric.outputCount,
        todayOutput: m.metric.todayOutput,
        temperature: m.metric.temperature ? Number(m.metric.temperature) : null,
        powerKw: m.metric.powerKw ? Number(m.metric.powerKw) : null,
        runtimeMin: m.metric.runtimeMin,
        downtimeMin: m.metric.downtimeMin,
        source: m.metric.source,
        updatedAt: m.metric.updatedAt,
        operatorName: m.metric.operator?.nameEn ?? null,
      } : null,
      alarms: m.alarms,
      openWorkOrders: m.workOrders,
    })));
  } catch (e) {
    return err(e);
  }
}

export async function getMachineDetail(machineId: number) {
  try {
    await guard("factory.view");

    const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [machine, runtimeLogs, alarmHistory, maintenanceHistory, oeeRecords, recentOrders] = await Promise.all([
      prisma.machine.findUnique({
        where: { id: machineId },
        include: {
          factoryArea: true,
          metric: { include: { operator: { select: { nameEn: true } }, currentOrder: { select: { orderCode: true, status: true } } } },
          assignedTechnician: { select: { nameEn: true } },
          workOrders: {
            where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
            include: { assignedTo: { select: { nameEn: true } } },
            take: 5,
          },
        },
      }),
      prisma.machineRuntimeLog.findMany({
        where: { machineId, logDate: { gte: last30 } },
        orderBy: { logDate: "desc" },
        take: 30,
      }),
      prisma.factoryAlarm.findMany({
        where: { machineId },
        orderBy: { triggeredAt: "desc" },
        take: 20,
        include: { acknowledgedBy: { select: { name: true } } },
      }),
      prisma.maintenanceLog.findMany({
        where: { machineId },
        orderBy: { startedAt: "desc" },
        take: 10,
        include: { performedBy: { select: { nameEn: true } } },
      }),
      prisma.oEERecord.findMany({
        where: { machineId, periodType: "DAY", periodDate: { gte: last30 } },
        orderBy: { periodDate: "desc" },
        take: 30,
      }),
      prisma.productionOrder.findMany({
        where: { machineId, status: { in: ["IN_PROGRESS", "COMPLETED"] } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, orderCode: true, status: true, plannedDate: true, completedDate: true },
      }),
    ]);

    if (!machine) return { ok: false as const, error: "Machine not found" };

    return ok({
      machine: {
        ...machine,
        capacityKgPerShift: machine.capacityKgPerShift ? Number(machine.capacityKgPerShift) : null,
        metric: machine.metric ? {
          ...machine.metric,
          speedRpm: machine.metric.speedRpm ? Number(machine.metric.speedRpm) : null,
          temperature: machine.metric.temperature ? Number(machine.metric.temperature) : null,
          powerKw: machine.metric.powerKw ? Number(machine.metric.powerKw) : null,
        } : null,
      },
      runtimeLogs: runtimeLogs.map(r => ({
        ...r,
        outputKg: Number(r.outputKg),
        logDate: r.logDate,
      })),
      alarmHistory,
      maintenanceHistory,
      oeeRecords: oeeRecords.map(r => ({
        ...r,
        availability: Number(r.availability),
        performance: Number(r.performance),
        quality: Number(r.quality),
        oee: Number(r.oee),
      })),
      recentOrders,
    });
  } catch (e) {
    return err(e);
  }
}

export async function upsertMachineMetric(input: {
  machineId: number;
  isRunning?: boolean;
  currentOrderId?: number | null;
  speedRpm?: number | null;
  outputCount?: number;
  todayOutput?: number;
  temperature?: number | null;
  powerKw?: number | null;
  runtimeMin?: number;
  downtimeMin?: number;
  operatorId?: number | null;
}): Promise<AR<undefined>> {
  try {
    await guard("factory.manage");
    await prisma.machineMetric.upsert({
      where: { machineId: input.machineId },
      create: {
        machineId: input.machineId,
        isRunning: input.isRunning ?? false,
        currentOrderId: input.currentOrderId,
        speedRpm: input.speedRpm,
        outputCount: input.outputCount ?? 0,
        todayOutput: input.todayOutput ?? 0,
        temperature: input.temperature,
        powerKw: input.powerKw,
        runtimeMin: input.runtimeMin ?? 0,
        downtimeMin: input.downtimeMin ?? 0,
        operatorId: input.operatorId,
        source: "MANUAL",
      },
      update: {
        ...(input.isRunning !== undefined && { isRunning: input.isRunning }),
        ...(input.currentOrderId !== undefined && { currentOrderId: input.currentOrderId }),
        ...(input.speedRpm !== undefined && { speedRpm: input.speedRpm }),
        ...(input.outputCount !== undefined && { outputCount: input.outputCount }),
        ...(input.todayOutput !== undefined && { todayOutput: input.todayOutput }),
        ...(input.temperature !== undefined && { temperature: input.temperature }),
        ...(input.powerKw !== undefined && { powerKw: input.powerKw }),
        ...(input.runtimeMin !== undefined && { runtimeMin: input.runtimeMin }),
        ...(input.downtimeMin !== undefined && { downtimeMin: input.downtimeMin }),
        ...(input.operatorId !== undefined && { operatorId: input.operatorId }),
        source: "MANUAL",
      },
    });
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}

export async function logMachineRuntime(input: {
  machineId: number;
  logDate: string;
  shiftType?: string;
  runtimeMin: number;
  downtimeMin: number;
  outputCount?: number;
  outputKg?: number;
  operatorId?: number;
  notes?: string;
}): Promise<AR<undefined>> {
  try {
    await guard("factory.manage");
    await prisma.machineRuntimeLog.upsert({
      where: {
        machineId_logDate_shiftType: {
          machineId: input.machineId,
          logDate: new Date(input.logDate),
          shiftType: input.shiftType ?? null,
        },
      },
      create: {
        machineId: input.machineId,
        logDate: new Date(input.logDate),
        shiftType: input.shiftType ?? null,
        runtimeMin: input.runtimeMin,
        downtimeMin: input.downtimeMin,
        outputCount: input.outputCount ?? 0,
        outputKg: input.outputKg ?? 0,
        operatorId: input.operatorId,
        notes: input.notes,
      },
      update: {
        runtimeMin: input.runtimeMin,
        downtimeMin: input.downtimeMin,
        outputCount: input.outputCount ?? 0,
        outputKg: input.outputKg ?? 0,
        operatorId: input.operatorId,
        notes: input.notes,
      },
    });
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}
