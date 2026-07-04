"use server";
import { prisma } from "@/lib/db";
import { guard } from "@/lib/auth/session";

type AR<T> = { ok: true; data: T } | { ok: false; error: string };
function ok<T>(data: T): AR<T> { return { ok: true, data }; }
function err(e: unknown): AR<never> { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }

export async function getFactoryOverview() {
  try {
    await guard("factory.view");

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      machines,
      activeAlarms,
      todayReports,
      monthlyReports,
      openOrders,
      recentMaintenanceLogs,
      overdueSchedules,
    ] = await Promise.all([
      prisma.machine.findMany({
        include: {
          factoryArea: { select: { name: true, code: true } },
          metric: true,
          alarms: { where: { status: "ACTIVE" }, select: { id: true, severity: true } },
          workOrders: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, select: { id: true } },
        },
        orderBy: [{ factoryAreaId: "asc" }, { code: "asc" }],
      }),
      prisma.factoryAlarm.count({ where: { status: "ACTIVE" } }),
      prisma.dailyProductionReport.findMany({
        where: { reportDate: { equals: new Date(todayStr) } },
        select: { meshProducedKg: true, downtimeMinutes: true, headcount: true, shift: true },
      }),
      prisma.dailyProductionReport.aggregate({
        where: { reportDate: { gte: monthStart } },
        _sum: { meshProducedKg: true, downtimeMinutes: true },
      }),
      prisma.productionOrder.count({ where: { status: "IN_PROGRESS" } }),
      prisma.maintenanceLog.findMany({
        where: { startedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        select: { machineId: true, type: true, downtimeMinutes: true },
        take: 10,
      }),
      prisma.maintenanceSchedule.count({
        where: { active: true, nextDueDate: { lte: today } },
      }),
    ]);

    const totalMachines = machines.length;
    const runningMachines = machines.filter(m => m.metric?.isRunning).length;
    const operationalMachines = machines.filter(m => m.status === "OPERATIONAL").length;
    const underMaintenanceMachines = machines.filter(m => m.status === "UNDER_MAINTENANCE").length;
    const offlineMachines = machines.filter(m => m.status === "OFFLINE").length;
    const machineUtilPct = totalMachines > 0 ? Math.round((operationalMachines / totalMachines) * 100) : 0;

    const todayOutputKg = todayReports.reduce((s, r) => s + Number(r.meshProducedKg), 0);
    const todayDowntimeMin = todayReports.reduce((s, r) => s + r.downtimeMinutes, 0);
    const monthOutputKg = Number(monthlyReports._sum.meshProducedKg ?? 0);

    // Runtime efficiency = (shift time - downtime) / shift time × 100
    const shiftMinutes = 480; // 8 hours
    const efficiencyPct = todayDowntimeMin < shiftMinutes
      ? Math.round(((shiftMinutes - todayDowntimeMin) / shiftMinutes) * 100)
      : 0;

    const machineList = machines.map(m => ({
      id: m.id,
      code: m.code,
      name: m.name,
      type: m.type,
      status: m.status,
      factoryArea: m.factoryArea ? { name: m.factoryArea.name, code: m.factoryArea.code } : null,
      isRunning: m.metric?.isRunning ?? false,
      todayOutput: m.metric?.todayOutput ?? 0,
      temperature: m.metric?.temperature ? Number(m.metric.temperature) : null,
      powerKw: m.metric?.powerKw ? Number(m.metric.powerKw) : null,
      runtimeMin: m.metric?.runtimeMin ?? 0,
      activeAlarmCount: m.alarms.length,
      criticalAlarmCount: m.alarms.filter(a => a.severity === "CRITICAL").length,
      openWorkOrders: m.workOrders.length,
      metricUpdatedAt: m.metric?.updatedAt ?? null,
    }));

    return ok({
      totalMachines,
      runningMachines,
      operationalMachines,
      underMaintenanceMachines,
      offlineMachines,
      machineUtilPct,
      activeAlarms,
      overdueSchedules,
      todayOutputKg: Math.round(todayOutputKg * 10) / 10,
      todayDowntimeMin,
      monthOutputKg: Math.round(monthOutputKg * 10) / 10,
      openOrders,
      efficiencyPct,
      machines: machineList,
    });
  } catch (e) {
    return err(e);
  }
}

export async function getFactoryAreaBreakdown() {
  try {
    await guard("factory.view");
    const areas = await prisma.factoryArea.findMany({
      include: {
        machines: {
          select: { id: true, code: true, name: true, status: true, metric: { select: { isRunning: true, todayOutput: true } } },
        },
      },
      orderBy: { code: "asc" },
    });
    return ok(areas.map(a => ({
      id: a.id,
      name: a.name,
      code: a.code,
      description: a.description,
      machineCount: a.machines.length,
      runningCount: a.machines.filter(m => m.metric?.isRunning).length,
      operationalCount: a.machines.filter(m => m.status === "OPERATIONAL").length,
      machines: a.machines.map(m => ({
        id: m.id, code: m.code, name: m.name, status: m.status,
        isRunning: m.metric?.isRunning ?? false,
        todayOutput: m.metric?.todayOutput ?? 0,
      })),
    })));
  } catch (e) {
    return err(e);
  }
}
