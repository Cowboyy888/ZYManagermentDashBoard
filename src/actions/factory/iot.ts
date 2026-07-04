"use server";
import { prisma } from "@/lib/db";
import { guard } from "@/lib/auth/session";
import type { IoTDeviceType } from "@prisma/client";

type AR<T> = { ok: true; data: T } | { ok: false; error: string };
function ok<T>(data: T): AR<T> { return { ok: true, data }; }
function err(e: unknown): AR<never> { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }

export async function listIoTDevices(filter?: { machineId?: number; areaId?: number; deviceType?: IoTDeviceType }) {
  try {
    await guard("factory.view");
    const devices = await prisma.ioTDevice.findMany({
      where: {
        ...(filter?.machineId !== undefined && { machineId: filter.machineId }),
        ...(filter?.areaId !== undefined && { factoryAreaId: filter.areaId }),
        ...(filter?.deviceType && { deviceType: filter.deviceType }),
      },
      include: {
        machine: { select: { code: true, name: true } },
        factoryArea: { select: { code: true, name: true } },
        readings: { orderBy: { recordedAt: "desc" }, take: 1 },
      },
      orderBy: [{ machineId: "asc" }, { deviceCode: "asc" }],
    });

    return ok(devices.map(d => ({
      id: d.id,
      deviceCode: d.deviceCode,
      deviceType: d.deviceType,
      protocol: d.protocol ?? "—",
      ipAddress: d.ipAddress,
      port: d.port,
      isActive: d.active,
      lastSeenAt: d.lastSeenAt,
      machine: d.machine,
      factoryArea: d.factoryArea,
      latestReading: d.readings[0]
        ? { metricKey: d.readings[0].metric, value: Number(d.readings[0].value), unit: d.readings[0].unit, recordedAt: d.readings[0].recordedAt }
        : null,
      configuredAt: d.createdAt,
    })));
  } catch (e) {
    return err(e);
  }
}

export async function getIoTDeviceSummary() {
  try {
    await guard("factory.view");
    const [total, active, byType] = await Promise.all([
      prisma.ioTDevice.count(),
      prisma.ioTDevice.count({ where: { active: true } }),
      prisma.ioTDevice.groupBy({ by: ["deviceType"], _count: { id: true } }),
    ]);

    const offlineCutoff = new Date(Date.now() - 5 * 60 * 1000);
    const offline = await prisma.ioTDevice.count({
      where: { active: true, lastSeenAt: { lt: offlineCutoff } },
    });

    return ok({
      total,
      active,
      offline,
      online: active - offline,
      byType: byType.map(g => ({ deviceType: g.deviceType, count: g._count.id })),
    });
  } catch (e) {
    return err(e);
  }
}

export async function registerIoTDevice(input: {
  deviceCode: string;
  name: string;
  deviceType: IoTDeviceType;
  protocol?: string;
  ipAddress?: string;
  port?: number;
  machineId?: number;
  factoryAreaId?: number;
  config?: Record<string, string | number | boolean | null>;
}): Promise<AR<{ id: number }>> {
  try {
    await guard("factory.manage");
    const device = await prisma.ioTDevice.create({
      data: {
        deviceCode: input.deviceCode,
        name: input.name,
        deviceType: input.deviceType,
        protocol: input.protocol,
        ipAddress: input.ipAddress,
        port: input.port,
        machineId: input.machineId,
        factoryAreaId: input.factoryAreaId,
        config: input.config ?? {},
        active: true,
      },
    });
    return ok({ id: device.id });
  } catch (e) {
    return err(e);
  }
}

export async function updateIoTDevice(
  deviceId: number,
  update: { active?: boolean; ipAddress?: string; port?: number; config?: Record<string, string | number | boolean | null> }
): Promise<AR<undefined>> {
  try {
    await guard("factory.manage");
    await prisma.ioTDevice.update({
      where: { id: deviceId },
      data: {
        ...(update.active !== undefined && { active: update.active }),
        ...(update.ipAddress !== undefined && { ipAddress: update.ipAddress }),
        ...(update.port !== undefined && { port: update.port }),
        ...(update.config !== undefined && { config: update.config }),
      },
    });
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}

export async function recordIoTReading(input: {
  deviceId: number;
  metric: string;
  value: number;
  unit?: string;
}): Promise<AR<undefined>> {
  try {
    await guard("factory.manage");
    await prisma.$transaction([
      prisma.ioTReading.create({
        data: {
          deviceId: input.deviceId,
          metric: input.metric,
          value: input.value,
          unit: input.unit,
        },
      }),
      prisma.ioTDevice.update({
        where: { id: input.deviceId },
        data: { lastSeenAt: new Date() },
      }),
    ]);
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}

export async function getRecentReadings(deviceId: number, limit = 50) {
  try {
    await guard("factory.view");
    const readings = await prisma.ioTReading.findMany({
      where: { deviceId },
      orderBy: { recordedAt: "desc" },
      take: limit,
    });
    return ok(readings.map(r => ({
      id: Number(r.id),
      metricKey: r.metric,
      value: Number(r.value),
      unit: r.unit,
      recordedAt: r.recordedAt,
    })));
  } catch (e) {
    return err(e);
  }
}
