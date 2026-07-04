"use server";
import { prisma } from "@/lib/db";
import { guard } from "@/lib/auth/session";
import type { AlarmType, AlarmSeverity } from "@prisma/client";

type AR<T> = { ok: true; data: T } | { ok: false; error: string };
function ok<T>(data: T): AR<T> { return { ok: true, data }; }
function err(e: unknown): AR<never> { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }

export async function listAlarms(filter?: { status?: string; severity?: string; machineId?: number }) {
  try {
    await guard("factory.view");
    const alarms = await prisma.factoryAlarm.findMany({
      where: {
        ...(filter?.status && { status: filter.status as "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" }),
        ...(filter?.severity && { severity: filter.severity as "INFO" | "WARNING" | "CRITICAL" }),
        ...(filter?.machineId && { machineId: filter.machineId }),
      },
      include: {
        machine: { select: { code: true, name: true } },
        acknowledgedBy: { select: { name: true } },
        resolvedBy: { select: { name: true } },
      },
      orderBy: { triggeredAt: "desc" },
      take: 200,
    });
    return ok(alarms);
  } catch (e) {
    return err(e);
  }
}

export async function getActiveAlarmCounts() {
  try {
    await guard("factory.view");
    const [critical, warning, info] = await Promise.all([
      prisma.factoryAlarm.count({ where: { status: "ACTIVE", severity: "CRITICAL" } }),
      prisma.factoryAlarm.count({ where: { status: "ACTIVE", severity: "WARNING" } }),
      prisma.factoryAlarm.count({ where: { status: "ACTIVE", severity: "INFO" } }),
    ]);
    return ok({ critical, warning, info, total: critical + warning + info });
  } catch (e) {
    return err(e);
  }
}

export async function createAlarm(input: {
  machineId?: number;
  alarmType: AlarmType;
  severity: AlarmSeverity;
  title: string;
  description?: string;
}): Promise<AR<undefined>> {
  try {
    await guard("factory.manage");
    await prisma.factoryAlarm.create({
      data: {
        machineId: input.machineId,
        alarmType: input.alarmType,
        severity: input.severity,
        title: input.title,
        description: input.description,
        status: "ACTIVE",
      },
    });
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}

export async function acknowledgeAlarm(alarmId: number, notes?: string): Promise<AR<undefined>> {
  try {
    const actor = await guard("factory.manage");
    await prisma.factoryAlarm.update({
      where: { id: alarmId },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedAt: new Date(),
        acknowledgedById: actor.id,
        notes: notes ?? undefined,
      },
    });
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}

export async function resolveAlarm(alarmId: number, notes?: string): Promise<AR<undefined>> {
  try {
    const actor = await guard("factory.manage");
    await prisma.factoryAlarm.update({
      where: { id: alarmId },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolvedById: actor.id,
        notes: notes ?? undefined,
      },
    });
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}

/** Auto-generate alarms from current system state. Call from cron or on-demand. */
export async function evaluateAndCreateAlarms(): Promise<AR<number>> {
  try {
    await guard("factory.manage");
    let created = 0;
    const today = new Date();

    // 1. Machines that are OFFLINE
    const offlineMachines = await prisma.machine.findMany({
      where: { status: "OFFLINE" },
      select: { id: true, name: true, code: true },
    });
    for (const m of offlineMachines) {
      const existing = await prisma.factoryAlarm.findFirst({
        where: { machineId: m.id, alarmType: "MACHINE_STOPPED", status: { in: ["ACTIVE", "ACKNOWLEDGED"] } },
      });
      if (!existing) {
        await prisma.factoryAlarm.create({
          data: {
            machineId: m.id, alarmType: "MACHINE_STOPPED", severity: "CRITICAL",
            title: `${m.code} — Machine Offline`, description: `Machine ${m.name} is offline.`,
          },
        });
        created++;
      }
    }

    // 2. Overdue maintenance schedules
    const overdue = await prisma.maintenanceSchedule.findMany({
      where: { active: true, nextDueDate: { lte: today } },
      include: { machine: { select: { id: true, code: true, name: true } } },
      take: 20,
    });
    for (const s of overdue) {
      const existing = await prisma.factoryAlarm.findFirst({
        where: { machineId: s.machineId, alarmType: "MAINTENANCE_OVERDUE", status: { in: ["ACTIVE", "ACKNOWLEDGED"] } },
      });
      if (!existing) {
        await prisma.factoryAlarm.create({
          data: {
            machineId: s.machineId, alarmType: "MAINTENANCE_OVERDUE", severity: "WARNING",
            title: `${s.machine.code} — Maintenance Overdue`,
            description: `"${s.title}" was due ${s.nextDueDate.toLocaleDateString()}.`,
          },
        });
        created++;
      }
    }

    // 3. High defect rate (last 7 days)
    const last7 = new Date(today); last7.setDate(today.getDate() - 7);
    const qcGroups = await prisma.qualityCheck.groupBy({
      by: ["orderId"],
      where: { checkDate: { gte: last7 } },
      _count: { id: true },
      _sum: { defectCount: true, sampleSize: true },
    });
    for (const g of qcGroups) {
      const defectRate = g._sum.sampleSize && g._sum.sampleSize > 0
        ? ((g._sum.defectCount ?? 0) / g._sum.sampleSize) * 100
        : 0;
      if (defectRate > 10) {
        const existing = await prisma.factoryAlarm.findFirst({
          where: { alarmType: "HIGH_DEFECT_RATE", status: { in: ["ACTIVE", "ACKNOWLEDGED"] }, triggeredAt: { gte: last7 } },
        });
        if (!existing) {
          await prisma.factoryAlarm.create({
            data: {
              alarmType: "HIGH_DEFECT_RATE", severity: "WARNING",
              title: "High Defect Rate Detected",
              description: `Defect rate of ${defectRate.toFixed(1)}% detected in last 7 days.`,
            },
          });
          created++;
          break;
        }
      }
    }

    // 4. Low raw material
    const lowWire = await prisma.wireInventory.findFirst({
      where: { remainingKg: { lt: 500 } },
    });
    if (lowWire) {
      const existing = await prisma.factoryAlarm.findFirst({
        where: { alarmType: "LOW_RAW_MATERIAL", status: { in: ["ACTIVE", "ACKNOWLEDGED"] } },
      });
      if (!existing) {
        await prisma.factoryAlarm.create({
          data: {
            alarmType: "LOW_RAW_MATERIAL", severity: "WARNING",
            title: "Low Wire Rod Stock",
            description: `Batch ${lowWire.batchCode}: only ${lowWire.remainingKg} kg remaining.`,
          },
        });
        created++;
      }
    }

    return ok(created);
  } catch (e) {
    return err(e);
  }
}
