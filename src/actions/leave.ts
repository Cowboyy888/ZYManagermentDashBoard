"use server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../lib/db";
import { guard } from "../lib/auth/session";
import { writeAudit } from "../lib/audit";
import type { ActionResult } from "./employees";

const LeaveInput = z.object({
  employeeId: z.coerce.number().int().positive(),
  type: z.enum(["ANNUAL", "SICK", "SPECIAL", "UNPAID", "PERMITTED"]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  halfDay: z.boolean().default(false),
  reason: z.string().max(300).optional().nullable(),
});

export async function createLeaveRequest(raw: unknown): Promise<ActionResult<{ id: number }>> {
  try {
    const parsed = LeaveInput.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
    const { employeeId, type, startDate, endDate, halfDay, reason } = parsed.data;

    if (endDate < startDate) return { ok: false, error: "End date must be on or after start date" };

    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { departmentId: true },
    });
    if (!emp) return { ok: false, error: "Employee not found" };

    const actor = await guard("leave.request", { targetDeptId: emp.departmentId });

    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: endDate },
        endDate:   { gte: startDate },
      },
    });
    if (overlap) return { ok: false, error: "Employee already has an overlapping leave request for this period." };

    const req = await prisma.leaveRequest.create({
      data: { employeeId, type, startDate, endDate, halfDay, reason: reason ?? null, status: "PENDING" },
    });

    await writeAudit({
      userId: actor.id,
      action: "leave.request",
      entityType: "LeaveRequest",
      entityId: req.id.toString(),
      after: { employeeId, type, startDate, endDate, halfDay, status: "PENDING" },
    });
    revalidatePath("/leave");
    return { ok: true, data: { id: Number(req.id) } };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function approveLeaveRequest(id: number): Promise<ActionResult<undefined>> {
  try {
    const actor = await guard("leave.approve");
    const before = await prisma.leaveRequest.findUnique({ where: { id: BigInt(id) } });
    if (!before) return { ok: false, error: "Leave request not found" };
    if (before.status !== "PENDING") return { ok: false, error: "Request is no longer pending" };

    const after = await prisma.leaveRequest.update({
      where: { id: BigInt(id) },
      data: { status: "APPROVED", decidedById: actor.id },
    });

    await writeAudit({
      userId: actor.id,
      action: "leave.approve",
      entityType: "LeaveRequest",
      entityId: id.toString(),
      before: { status: before.status },
      after: { status: after.status, decidedById: actor.id },
    });
    revalidatePath("/leave");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function rejectLeaveRequest(id: number, reason?: string): Promise<ActionResult<undefined>> {
  try {
    const actor = await guard("leave.approve");
    const before = await prisma.leaveRequest.findUnique({ where: { id: BigInt(id) } });
    if (!before) return { ok: false, error: "Leave request not found" };
    if (before.status !== "PENDING") return { ok: false, error: "Request is no longer pending" };

    const after = await prisma.leaveRequest.update({
      where: { id: BigInt(id) },
      data: { status: "REJECTED", decidedById: actor.id, rejectionReason: reason ?? null },
    });

    await writeAudit({
      userId: actor.id,
      action: "leave.reject",
      entityType: "LeaveRequest",
      entityId: id.toString(),
      before: { status: before.status },
      after: { status: after.status, decidedById: actor.id },
    });
    revalidatePath("/leave");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function cancelLeaveRequest(id: number): Promise<ActionResult<undefined>> {
  try {
    const actor = await guard("leave.request");
    const req = await prisma.leaveRequest.findUnique({
      where: { id: BigInt(id) },
      include: { employee: { select: { departmentId: true } } },
    });
    if (!req) return { ok: false, error: "Leave request not found" };
    if (req.status !== "PENDING") return { ok: false, error: "Only pending requests can be cancelled" };

    if (actor.role === "SUPERVISOR") {
      await guard("leave.request", { targetDeptId: req.employee.departmentId });
    }

    await prisma.leaveRequest.delete({ where: { id: BigInt(id) } });
    await writeAudit({
      userId: actor.id,
      action: "leave.cancel",
      entityType: "LeaveRequest",
      entityId: id.toString(),
      before: { employeeId: req.employeeId, type: req.type, status: req.status },
    });
    revalidatePath("/leave");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateLeaveRequest(id: number, raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const actor = await guard("leave.request");
    const req = await prisma.leaveRequest.findUnique({
      where: { id: BigInt(id) },
      include: { employee: { select: { departmentId: true } } },
    });
    if (!req) return { ok: false, error: "Leave request not found" };
    if (req.status !== "PENDING") return { ok: false, error: "Only pending requests can be edited" };

    if (actor.role === "SUPERVISOR") {
      await guard("leave.request", { targetDeptId: req.employee.departmentId });
    }

    const UpdateInput = z.object({
      type: z.enum(["ANNUAL", "SICK", "SPECIAL", "UNPAID", "PERMITTED"]),
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      halfDay: z.boolean().default(false),
      reason: z.string().max(300).optional().nullable(),
    });
    const parsed = UpdateInput.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
    const { type, startDate, endDate, halfDay, reason } = parsed.data;

    if (endDate < startDate) return { ok: false, error: "End date must be on or after start date" };

    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        id: { not: BigInt(id) },
        employeeId: req.employeeId,
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: endDate },
        endDate:   { gte: startDate },
      },
    });
    if (overlap) return { ok: false, error: "Overlaps with an existing leave request." };

    const before = { type: req.type, startDate: req.startDate, endDate: req.endDate };
    await prisma.leaveRequest.update({
      where: { id: BigInt(id) },
      data: { type, startDate, endDate, halfDay, reason: reason ?? null },
    });
    await writeAudit({
      userId: actor.id,
      action: "leave.update",
      entityType: "LeaveRequest",
      entityId: id.toString(),
      before,
      after: { type, startDate, endDate },
    });
    revalidatePath("/leave");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function listLeaveRequests() {
  try {
    const actor = await guard("leave.read");
    const deptFilter: Prisma.LeaveRequestWhereInput =
      actor.role === "SUPERVISOR" && actor.departmentId
        ? { employee: { departmentId: actor.departmentId } }
        : {};

    const data = await prisma.leaveRequest.findMany({
      where: { ...deptFilter },
      include: {
        employee: {
          select: {
            id: true,
            nameEn: true,
            nameKh: true,
            employeeCode: true,
            departmentId: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      take: 500,
    });

    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

export type LeaveBalanceSummary = {
  employeeId: number;
  nameEn: string;
  nameKh: string;
  departmentName: string | null;
  departmentId: number | null;
  balances: Record<string, { granted: number; used: number; remaining: number }>;
};

const DEFAULT_GRANTED: Record<string, number> = {
  ANNUAL: 18,
  SICK: 30,
  SPECIAL: 7,
  UNPAID: 0,
  PERMITTED: 0,
};
const LEAVE_TYPES = ["ANNUAL", "SICK", "SPECIAL", "UNPAID", "PERMITTED"] as const;

export async function listLeaveBalancesForYear(year: number): Promise<ActionResult<LeaveBalanceSummary[]>> {
  try {
    await guard("leave.read");
    const yearStart = new Date(year, 0, 1);
    const yearEnd   = new Date(year, 11, 31);

    const [employees, storedBalances, approvedLeaves] = await Promise.all([
      prisma.employee.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true, nameEn: true, nameKh: true,
          departmentId: true,
          department: { select: { name: true } },
        },
        orderBy: { nameEn: "asc" },
      }),
      prisma.leaveBalance.findMany({ where: { year } }),
      prisma.leaveRequest.findMany({
        where: {
          status: "APPROVED",
          startDate: { gte: yearStart, lte: yearEnd },
        },
        select: { employeeId: true, type: true, startDate: true, endDate: true, halfDay: true },
      }),
    ]);

    const grantedMap = new Map<string, number>();
    for (const b of storedBalances) {
      grantedMap.set(`${b.employeeId}:${b.type}`, b.granted);
    }

    const usedMap = new Map<string, number>();
    for (const l of approvedLeaves) {
      const days = l.halfDay
        ? 0.5
        : Math.round((new Date(l.endDate).getTime() - new Date(l.startDate).getTime()) / 86400000) + 1;
      const key = `${l.employeeId}:${l.type}`;
      usedMap.set(key, (usedMap.get(key) ?? 0) + days);
    }

    const data: LeaveBalanceSummary[] = employees.map((emp) => {
      const balances: Record<string, { granted: number; used: number; remaining: number }> = {};
      for (const type of LEAVE_TYPES) {
        const granted = grantedMap.get(`${emp.id}:${type}`) ?? DEFAULT_GRANTED[type];
        const used    = usedMap.get(`${emp.id}:${type}`) ?? 0;
        balances[type] = { granted, used, remaining: Math.max(0, granted - used) };
      }
      return {
        employeeId: emp.id,
        nameEn: emp.nameEn,
        nameKh: emp.nameKh,
        departmentName: emp.department?.name ?? null,
        departmentId: emp.departmentId,
        balances,
      };
    });

    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function setLeaveBalance(
  employeeId: number,
  year: number,
  type: string,
  granted: number,
): Promise<ActionResult<undefined>> {
  try {
    const actor = await guard("employee.update");
    await prisma.leaveBalance.upsert({
      where: { employeeId_year_type: { employeeId, year, type: type as "ANNUAL" | "SICK" | "SPECIAL" | "UNPAID" | "PERMITTED" } },
      update: { granted },
      create: { employeeId, year, type: type as "ANNUAL" | "SICK" | "SPECIAL" | "UNPAID" | "PERMITTED", granted },
    });
    await writeAudit({
      userId: actor.id,
      action: "leave.balance.set",
      entityType: "LeaveBalance",
      entityId: `${employeeId}:${year}:${type}`,
      after: { employeeId, year, type, granted },
    });
    revalidatePath("/leave");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

function errMsg(e: unknown): string {
  if (e instanceof Error) {
    if (e.message === "Not authenticated") redirect("/login");
    if (e.name === "ForbiddenError") return "You do not have permission for this action.";
    return e.message;
  }
  return "Unexpected error";
}
