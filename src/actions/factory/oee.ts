"use server";
import { prisma } from "@/lib/db";
import { guard } from "@/lib/auth/session";

type AR<T> = { ok: true; data: T } | { ok: false; error: string };
function ok<T>(data: T): AR<T> { return { ok: true, data }; }
function err(e: unknown): AR<never> { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }

function calcOEE(planned: number, downtime: number, actual: number, target: number | null, defects: number) {
  const available = Math.max(planned - downtime, 0);
  const availability = planned > 0 ? (available / planned) * 100 : 0;
  const performance = target && target > 0 ? Math.min((actual / target) * 100, 100) : (actual > 0 ? 85 : 0);
  const totalOutput = actual + defects;
  const quality = totalOutput > 0 ? (actual / totalOutput) * 100 : 100;
  const oee = (availability * performance * quality) / 10000;
  return {
    availability: Math.round(availability * 100) / 100,
    performance: Math.round(performance * 100) / 100,
    quality: Math.round(quality * 100) / 100,
    oee: Math.round(oee * 100) / 100,
  };
}

export async function getOEETrend(machineId?: number, days = 30) {
  try {
    await guard("factory.view");
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const records = await prisma.oEERecord.findMany({
      where: {
        periodType: "DAY",
        periodDate: { gte: since },
        ...(machineId && { machineId }),
      },
      include: { machine: { select: { code: true, name: true } } },
      orderBy: { periodDate: "asc" },
    });

    return ok(records.map(r => ({
      machineId: r.machineId,
      machineCode: r.machine.code,
      machineName: r.machine.name,
      periodDate: r.periodDate,
      availability: Number(r.availability),
      performance: Number(r.performance),
      quality: Number(r.quality),
      oee: Number(r.oee),
      downtimeMin: r.downtimeMin,
      actualOutput: r.actualOutput,
      defectCount: r.defectCount,
    })));
  } catch (e) {
    return err(e);
  }
}

export async function getOEEByMachine() {
  try {
    await guard("factory.view");
    const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const machines = await prisma.machine.findMany({
      where: { status: { not: "RETIRED" } },
      select: { id: true, code: true, name: true, type: true, factoryAreaId: true, factoryArea: { select: { name: true } } },
    });

    const results = await Promise.all(
      machines.map(async m => {
        const records = await prisma.oEERecord.findMany({
          where: { machineId: m.id, periodType: "DAY", periodDate: { gte: last30 } },
        });
        if (records.length === 0) {
          const logs = await prisma.maintenanceLog.aggregate({
            where: { machineId: m.id, startedAt: { gte: last30 } },
            _sum: { downtimeMinutes: true },
          });
          const downtimeMin = Number(logs._sum.downtimeMinutes ?? 0);
          const plannedMin = records.length * 480;
          const metrics = calcOEE(plannedMin || 480, downtimeMin, 0, null, 0);
          return { machineId: m.id, code: m.code, name: m.name, factoryArea: m.factoryArea?.name ?? null, ...metrics, recordCount: 0 };
        }
        const avg = {
          availability: records.reduce((s, r) => s + Number(r.availability), 0) / records.length,
          performance: records.reduce((s, r) => s + Number(r.performance), 0) / records.length,
          quality: records.reduce((s, r) => s + Number(r.quality), 0) / records.length,
          oee: records.reduce((s, r) => s + Number(r.oee), 0) / records.length,
        };
        return {
          machineId: m.id, code: m.code, name: m.name, factoryArea: m.factoryArea?.name ?? null,
          availability: Math.round(avg.availability * 100) / 100,
          performance: Math.round(avg.performance * 100) / 100,
          quality: Math.round(avg.quality * 100) / 100,
          oee: Math.round(avg.oee * 100) / 100,
          recordCount: records.length,
        };
      })
    );

    return ok(results.sort((a, b) => b.oee - a.oee));
  } catch (e) {
    return err(e);
  }
}

export async function upsertOEERecord(input: {
  machineId: number;
  periodType: "DAY" | "WEEK" | "MONTH";
  periodDate: string;
  plannedTimeMin?: number;
  downtimeMin: number;
  targetOutput?: number;
  actualOutput: number;
  totalOutput?: number;
  defectCount?: number;
}): Promise<AR<undefined>> {
  try {
    await guard("factory.manage");
    const planned = input.plannedTimeMin ?? 480;
    const defects = input.defectCount ?? 0;
    const total = input.totalOutput ?? input.actualOutput;
    const { availability, performance, quality, oee } = calcOEE(planned, input.downtimeMin, input.actualOutput, input.targetOutput ?? null, defects);

    await prisma.oEERecord.upsert({
      where: {
        machineId_periodType_periodDate: {
          machineId: input.machineId,
          periodType: input.periodType,
          periodDate: new Date(input.periodDate),
        },
      },
      create: {
        machineId: input.machineId,
        periodType: input.periodType,
        periodDate: new Date(input.periodDate),
        plannedTimeMin: planned,
        downtimeMin: input.downtimeMin,
        targetOutput: input.targetOutput,
        actualOutput: input.actualOutput,
        totalOutput: total,
        defectCount: defects,
        availability, performance, quality, oee,
      },
      update: {
        plannedTimeMin: planned,
        downtimeMin: input.downtimeMin,
        targetOutput: input.targetOutput,
        actualOutput: input.actualOutput,
        totalOutput: total,
        defectCount: defects,
        availability, performance, quality, oee,
      },
    });
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}

/** Compute OEE from existing production data and store records. */
export async function computeOEEFromProductionData(date: string): Promise<AR<number>> {
  try {
    await guard("factory.manage");
    const d = new Date(date);
    let computed = 0;

    const machines = await prisma.machine.findMany({ where: { status: { not: "RETIRED" } }, select: { id: true } });

    for (const m of machines) {
      const [logs, qc, runtimeLog] = await Promise.all([
        prisma.maintenanceLog.aggregate({
          where: { machineId: m.id, startedAt: { gte: d, lt: new Date(d.getTime() + 86400000) } },
          _sum: { downtimeMinutes: true },
        }),
        prisma.qualityCheck.findMany({
          where: { checkDate: d },
          select: { sampleSize: true, defectCount: true, result: true },
        }),
        prisma.machineRuntimeLog.findFirst({ where: { machineId: m.id, logDate: d } }),
      ]);

      const downtimeMin = Number(logs._sum.downtimeMinutes ?? 0);
      const defectCount = qc.reduce((s, c) => s + c.defectCount, 0);
      const totalSamples = qc.reduce((s, c) => s + c.sampleSize, 0);
      const actualOutput = runtimeLog?.outputCount ?? 0;

      const { availability, performance, quality, oee } = calcOEE(480, downtimeMin, actualOutput, null, defectCount);
      await prisma.oEERecord.upsert({
        where: { machineId_periodType_periodDate: { machineId: m.id, periodType: "DAY", periodDate: d } },
        create: { machineId: m.id, periodType: "DAY", periodDate: d, plannedTimeMin: 480, downtimeMin, actualOutput, totalOutput: totalSamples || actualOutput, defectCount, availability, performance, quality, oee },
        update: { downtimeMin, actualOutput, totalOutput: totalSamples || actualOutput, defectCount, availability, performance, quality, oee },
      });
      computed++;
    }

    return ok(computed);
  } catch (e) {
    return err(e);
  }
}
