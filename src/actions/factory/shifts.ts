"use server";
import { prisma } from "@/lib/db";
import { guard } from "@/lib/auth/session";

type AR<T> = { ok: true; data: T } | { ok: false; error: string };
function ok<T>(data: T): AR<T> { return { ok: true, data }; }
function err(e: unknown): AR<never> { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }

export async function getTodayShiftSummary() {
  try {
    await guard("factory.view");
    const today = new Date();
    const todayDate = new Date(today.toISOString().slice(0, 10));

    const reports = await prisma.dailyProductionReport.findMany({
      where: { reportDate: { equals: todayDate } },
      include: {
        createdBy: { select: { name: true } },
        factoryArea: { select: { name: true, code: true } },
      },
      orderBy: { shift: "asc" },
    });

    const totals = reports.reduce(
      (acc, r) => ({
        outputKg: acc.outputKg + Number(r.meshProducedKg),
        downtimeMin: acc.downtimeMin + r.downtimeMinutes,
        headcount: acc.headcount + r.headcount,
      }),
      { outputKg: 0, downtimeMin: 0, headcount: 0 }
    );

    return ok({
      date: todayDate,
      shifts: reports.map(r => ({
        id: Number(r.id),
        shift: r.shift,
        area: r.factoryArea ? { name: r.factoryArea.name, code: r.factoryArea.code } : null,
        outputKg: Number(r.meshProducedKg),
        downtimeMin: r.downtimeMinutes,
        headcount: r.headcount,
        submittedBy: r.createdBy.name,
        notes: r.notes,
      })),
      totals: {
        outputKg: Math.round(totals.outputKg * 10) / 10,
        downtimeMin: totals.downtimeMin,
        headcount: totals.headcount,
        efficiencyPct: totals.downtimeMin < 480
          ? Math.round(((480 - Math.min(totals.downtimeMin, 480)) / 480) * 100)
          : 0,
      },
    });
  } catch (e) {
    return err(e);
  }
}

export async function getShiftTrend(days = 14) {
  try {
    await guard("factory.view");
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const reports = await prisma.dailyProductionReport.findMany({
      where: { reportDate: { gte: since } },
      select: {
        reportDate: true,
        shift: true,
        meshProducedKg: true,
        downtimeMinutes: true,
        headcount: true,
      },
      orderBy: { reportDate: "asc" },
    });

    const byDate = new Map<string, { date: Date; outputKg: number; downtimeMin: number }>();
    for (const r of reports) {
      const key = r.reportDate.toISOString().slice(0, 10);
      const existing = byDate.get(key) ?? { date: r.reportDate, outputKg: 0, downtimeMin: 0 };
      byDate.set(key, {
        date: r.reportDate,
        outputKg: existing.outputKg + Number(r.meshProducedKg),
        downtimeMin: existing.downtimeMin + r.downtimeMinutes,
      });
    }

    return ok(Array.from(byDate.values()).map(d => ({
      date: d.date,
      outputKg: Math.round(d.outputKg * 10) / 10,
      downtimeMin: d.downtimeMin,
      efficiencyPct: d.downtimeMin < 480
        ? Math.round(((480 - Math.min(d.downtimeMin, 480)) / 480) * 100)
        : 0,
    })));
  } catch (e) {
    return err(e);
  }
}

export async function getCurrentShiftProgress() {
  try {
    await guard("factory.view");
    const now = new Date();
    const hour = now.getHours();

    let currentShift: string;
    let shiftStartHour: number;

    if (hour >= 6 && hour < 14) {
      currentShift = "DAY"; shiftStartHour = 6;
    } else if (hour >= 14 && hour < 22) {
      currentShift = "AFTERNOON"; shiftStartHour = 14;
    } else {
      currentShift = "NIGHT"; shiftStartHour = 22;
    }

    const shiftStart = new Date(now);
    shiftStart.setHours(shiftStartHour, 0, 0, 0);
    if (currentShift === "NIGHT" && hour < 6) {
      shiftStart.setDate(shiftStart.getDate() - 1);
    }

    const elapsedMin = Math.max(0, Math.floor((now.getTime() - shiftStart.getTime()) / 60000));
    const totalMin = 480;
    const remainingMin = Math.max(0, totalMin - elapsedMin);
    const progressPct = Math.min(100, Math.round((elapsedMin / totalMin) * 100));

    const [runningMachines, totalMetrics, todayReports] = await Promise.all([
      prisma.machineMetric.count({ where: { isRunning: true } }),
      prisma.machineMetric.count(),
      prisma.dailyProductionReport.findMany({
        where: {
          reportDate: { equals: new Date(now.toISOString().slice(0, 10)) },
          shift: currentShift,
        },
        select: { meshProducedKg: true },
      }),
    ]);

    const outputKg = todayReports.reduce((s, r) => s + Number(r.meshProducedKg), 0);

    return ok({
      currentShift,
      elapsedMin,
      remainingMin,
      progressPct,
      runningMachines,
      totalTrackedMachines: totalMetrics,
      outputKg: Math.round(outputKg * 10) / 10,
      targetKg: null as number | null,
      achievementPct: null as number | null,
    });
  } catch (e) {
    return err(e);
  }
}
