"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { guard } from "@/lib/auth/session";
import type { ActionResult } from "./employees";

// ── Schemas ────────────────────────────────────────────────────

const PlanInput = z.object({
  title:        z.string().min(1).max(200),
  description:  z.string().max(500).optional().nullable(),
  startDate:    z.coerce.date(),
  endDate:      z.coerce.date(),
  priority:     z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  shiftId:      z.coerce.number().int().positive().optional().nullable(),
  machineId:    z.coerce.number().int().positive().optional().nullable(),
  targetQtyKg:  z.coerce.number().positive().optional().nullable(),
  notes:        z.string().max(500).optional().nullable(),
});

// ── Helpers ────────────────────────────────────────────────────

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Unexpected error";
}

async function nextPlanNumber(): Promise<string> {
  const count = await prisma.productionPlan.count();
  return `PPS-${String(count + 1).padStart(5, "0")}`;
}

// ── List ────────────────────────────────────────────────────────

export async function listProductionPlans(opts?: {
  status?: string;
  from?: string;
  to?: string;
}) {
  try {
    await guard("production.read");
    const where: Record<string, unknown> = {};
    if (opts?.status && opts.status !== "ALL") where.status = opts.status;
    if (opts?.from || opts?.to) {
      where.startDate = {};
      if (opts.from) (where.startDate as Record<string, Date>).gte = new Date(opts.from);
      if (opts.to)   (where.startDate as Record<string, Date>).lte = new Date(opts.to);
    }
    const plans = await prisma.productionPlan.findMany({
      where,
      orderBy: [{ startDate: "asc" }, { priority: "desc" }],
      include: {
        shift:     { select: { id: true, name: true, color: true, startTime: true, endTime: true } },
        machine:   { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    return {
      ok: true as const,
      data: plans.map(p => ({
        ...p,
        priority:    p.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
        status:      p.status   as "DRAFT" | "RELEASED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
        targetQtyKg: p.targetQtyKg !== null ? Number(p.targetQtyKg) : null,
      })),
    };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

// ── Capacity snapshot ───────────────────────────────────────────

export async function getCapacitySnapshot() {
  try {
    await guard("production.read");
    const [machines, shifts, pendingOrders, activePlans] = await Promise.all([
      prisma.machine.count({ where: { status: "OPERATIONAL" } }),
      prisma.shift.count({ where: { active: true } }),
      prisma.productionOrder.count({ where: { status: { in: ["DRAFT", "IN_PROGRESS"] } } }),
      prisma.productionPlan.count({ where: { status: { in: ["RELEASED", "IN_PROGRESS"] } } }),
    ]);
    return { ok: true as const, data: { machines, shifts, pendingOrders, activePlans } };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

// ── Calendar data — plans grouped by date range ─────────────────

export async function getCalendarPlans(year: number, month: number) {
  try {
    await guard("production.read");
    const from = new Date(year, month - 1, 1);
    const to   = new Date(year, month, 0); // last day of month
    const plans = await prisma.productionPlan.findMany({
      where: {
        OR: [
          { startDate: { gte: from, lte: to } },
          { endDate:   { gte: from, lte: to } },
          { AND: [{ startDate: { lte: from } }, { endDate: { gte: to } }] },
        ],
      },
      select: {
        id: true, planNumber: true, title: true, status: true,
        priority: true, startDate: true, endDate: true,
        shift: { select: { color: true, name: true } },
      },
    });
    return { ok: true as const, data: plans };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

// ── Create ──────────────────────────────────────────────────────

export async function createProductionPlan(raw: unknown): Promise<ActionResult<{ id: number; planNumber: string }>> {
  try {
    const actor = await guard("production.manage");
    const p = PlanInput.safeParse(raw);
    if (!p.success) return { ok: false, error: p.error.errors[0].message };
    if (p.data.endDate < p.data.startDate) return { ok: false, error: "End date must be after start date" };
    const planNumber = await nextPlanNumber();
    const plan = await prisma.productionPlan.create({
      data: {
        planNumber,
        title:       p.data.title,
        description: p.data.description ?? null,
        startDate:   p.data.startDate,
        endDate:     p.data.endDate,
        priority:    p.data.priority,
        shiftId:     p.data.shiftId ?? null,
        machineId:   p.data.machineId ?? null,
        targetQtyKg: p.data.targetQtyKg ?? null,
        notes:       p.data.notes ?? null,
        createdById: actor.id,
      },
    });
    revalidatePath("/production/planning");
    return { ok: true, data: { id: plan.id, planNumber: plan.planNumber } };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Update status ───────────────────────────────────────────────

export async function updatePlanStatus(
  id: number,
  status: "DRAFT" | "RELEASED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
): Promise<ActionResult<void>> {
  try {
    await guard("production.manage");
    await prisma.productionPlan.update({ where: { id }, data: { status } });
    revalidatePath("/production/planning");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Update plan ─────────────────────────────────────────────────

export async function updateProductionPlan(id: number, raw: unknown): Promise<ActionResult<void>> {
  try {
    await guard("production.manage");
    const p = PlanInput.safeParse(raw);
    if (!p.success) return { ok: false, error: p.error.errors[0].message };
    if (p.data.endDate < p.data.startDate) return { ok: false, error: "End date must be after start date" };
    await prisma.productionPlan.update({
      where: { id },
      data: {
        title:       p.data.title,
        description: p.data.description ?? null,
        startDate:   p.data.startDate,
        endDate:     p.data.endDate,
        priority:    p.data.priority,
        shiftId:     p.data.shiftId ?? null,
        machineId:   p.data.machineId ?? null,
        targetQtyKg: p.data.targetQtyKg ?? null,
        notes:       p.data.notes ?? null,
      },
    });
    revalidatePath("/production/planning");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Delete ──────────────────────────────────────────────────────

export async function deleteProductionPlan(id: number): Promise<ActionResult<void>> {
  try {
    await guard("production.manage");
    await prisma.productionPlan.delete({ where: { id } });
    revalidatePath("/production/planning");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}
