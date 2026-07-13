"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { guard } from "@/lib/auth/session";
import type { ActionResult } from "./employees";

// ── Helpers ────────────────────────────────────────────────────

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Unexpected error";
}

// ── Work Execution ─────────────────────────────────────────────

const ExecutionInput = z.object({
  orderId:    z.coerce.number().int().positive(),
  operatorId: z.coerce.number().int().positive().optional().nullable(),
  machineId:  z.coerce.number().int().positive().optional().nullable(),
  notes:      z.string().max(500).optional().nullable(),
});

export async function listWorkExecutions(opts?: { status?: string; machineId?: number }) {
  try {
    await guard("production.read");
    const where: Record<string, unknown> = {};
    if (opts?.status && opts.status !== "ALL") where.status = opts.status;
    if (opts?.machineId) where.machineId = opts.machineId;
    const rows = await prisma.workExecution.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      include: {
        order:    { select: { id: true, orderCode: true, customer: true, status: true, plannedDate: true } },
        operator: { select: { id: true, nameEn: true, nameKh: true } },
        machine:  { select: { id: true, code: true, name: true } },
        _count:   { select: { downtimeEvents: true } },
      },
    });
    return { ok: true as const, data: rows };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

export async function getShopFloorSummary() {
  try {
    await guard("production.read");
    const [active, queued, today, downtime] = await Promise.all([
      prisma.workExecution.count({ where: { status: "IN_PROGRESS" } }),
      prisma.workExecution.count({ where: { status: "QUEUED" } }),
      prisma.workExecution.count({
        where: {
          startedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          status: "COMPLETED",
        },
      }),
      prisma.downtimeEvent.count({
        where: { endedAt: null },
      }),
    ]);
    return { ok: true as const, data: { active, queued, completedToday: today, activeDowntime: downtime } };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

export async function createWorkExecution(raw: unknown): Promise<ActionResult<{ id: number }>> {
  try {
    await guard("production.manage");
    const p = ExecutionInput.safeParse(raw);
    if (!p.success) return { ok: false, error: p.error.errors[0].message };
    const ex = await prisma.workExecution.create({
      data: {
        orderId:    p.data.orderId,
        operatorId: p.data.operatorId ?? null,
        machineId:  p.data.machineId  ?? null,
        notes:      p.data.notes      ?? null,
        status:     "QUEUED",
      },
    });
    revalidatePath("/production/shopfloor");
    return { ok: true, data: { id: ex.id } };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function startExecution(id: number): Promise<ActionResult<void>> {
  try {
    await guard("production.manage");
    await prisma.workExecution.update({
      where: { id },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });
    revalidatePath("/production/shopfloor");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function pauseExecution(id: number): Promise<ActionResult<void>> {
  try {
    await guard("production.manage");
    await prisma.workExecution.update({ where: { id }, data: { status: "PAUSED" } });
    revalidatePath("/production/shopfloor");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function completeExecution(
  id: number,
  qtyProduced: number,
  qtyScrap: number
): Promise<ActionResult<void>> {
  try {
    await guard("production.manage");
    await prisma.workExecution.update({
      where: { id },
      data: { status: "COMPLETED", completedAt: new Date(), qtyProduced, qtyScrap },
    });
    revalidatePath("/production/shopfloor");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Downtime Events ────────────────────────────────────────────

const DowntimeInput = z.object({
  executionId: z.coerce.number().int().positive(),
  reason:      z.enum(["BREAKDOWN", "SETUP", "MATERIAL_SHORTAGE", "QUALITY_ISSUE", "POWER_OUTAGE", "PLANNED_MAINTENANCE", "OTHER"]),
  notes:       z.string().max(300).optional().nullable(),
});

export async function reportDowntime(raw: unknown): Promise<ActionResult<{ id: number }>> {
  try {
    const actor = await guard("production.manage");
    const p = DowntimeInput.safeParse(raw);
    if (!p.success) return { ok: false, error: p.error.errors[0].message };
    const dt = await prisma.downtimeEvent.create({
      data: {
        executionId:  p.data.executionId,
        reason:       p.data.reason,
        notes:        p.data.notes ?? null,
        startedAt:    new Date(),
        reportedById: actor.id,
      },
    });
    revalidatePath("/production/shopfloor");
    return { ok: true, data: { id: dt.id } };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function resolveDowntime(id: number): Promise<ActionResult<void>> {
  try {
    await guard("production.manage");
    const dt = await prisma.downtimeEvent.findUniqueOrThrow({ where: { id } });
    const durationMin = dt.startedAt
      ? Math.round((Date.now() - dt.startedAt.getTime()) / 60000)
      : 0;
    await prisma.downtimeEvent.update({
      where: { id },
      data: { endedAt: new Date(), durationMin },
    });
    revalidatePath("/production/shopfloor");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function listDowntimeEvents(executionId?: number) {
  try {
    await guard("production.read");
    const rows = await prisma.downtimeEvent.findMany({
      where: executionId ? { executionId } : {},
      orderBy: { startedAt: "desc" },
      take: 50,
      include: {
        execution: { select: { id: true, order: { select: { orderCode: true } } } },
        reportedBy: { select: { id: true, name: true } },
      },
    });
    return { ok: true as const, data: rows };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}
