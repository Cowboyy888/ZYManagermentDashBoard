"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { guard } from "@/lib/auth/session";
import type { ActionResult } from "./employees";

// ── Schemas ────────────────────────────────────────────────────

const ShiftInput = z.object({
  code:           z.string().min(1).max(20).toUpperCase(),
  name:           z.string().min(1).max(100),
  description:    z.string().max(300).optional().nullable(),
  shiftType:      z.enum(["DAY", "AFTERNOON", "NIGHT", "ROTATING", "CUSTOM"]).default("DAY"),
  startTime:      z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
  endTime:        z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
  breakStart:     z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  breakEnd:       z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  workingHours:   z.coerce.number().positive().max(24),
  otStartsAfter:  z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  gracePeriodMin: z.coerce.number().int().min(0).max(120).default(15),
  color:          z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#3b82f6"),
  active:         z.boolean().default(true),
});

const AssignmentInput = z.object({
  shiftId:       z.coerce.number().int().positive(),
  employeeId:    z.coerce.number().int().positive(),
  effectiveFrom: z.coerce.date(),
  effectiveTo:   z.coerce.date().optional().nullable(),
  notes:         z.string().max(300).optional().nullable(),
});

// ── Shift CRUD ─────────────────────────────────────────────────

export type ShiftRow = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  shiftType: string;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  workingHours: number;
  otStartsAfter: string | null;
  gracePeriodMin: number;
  color: string;
  active: boolean;
  assignmentCount: number;
};

export async function getShifts(): Promise<ActionResult<ShiftRow[]>> {
  try {
    await guard("attendance.read");
    const rows = await prisma.shift.findMany({
      orderBy: [{ active: "desc" }, { shiftType: "asc" }, { name: "asc" }],
      include: { _count: { select: { assignments: true } } },
    });
    return {
      ok: true,
      data: rows.map(r => ({
        id:             r.id,
        code:           r.code,
        name:           r.name,
        description:    r.description,
        shiftType:      r.shiftType,
        startTime:      r.startTime,
        endTime:        r.endTime,
        breakStart:     r.breakStart,
        breakEnd:       r.breakEnd,
        workingHours:   Number(r.workingHours),
        otStartsAfter:  r.otStartsAfter,
        gracePeriodMin: r.gracePeriodMin,
        color:          r.color,
        active:         r.active,
        assignmentCount: r._count.assignments,
      })),
    };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function createShift(raw: unknown): Promise<ActionResult<{ id: number }>> {
  try {
    const parsed = ShiftInput.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors };
    }
    await guard("attendance.write");
    const d = parsed.data;
    const shift = await prisma.shift.create({
      data: {
        code:           d.code,
        name:           d.name,
        shiftType:      d.shiftType,
        startTime:      d.startTime,
        endTime:        d.endTime,
        workingHours:   d.workingHours,
        gracePeriodMin: d.gracePeriodMin,
        color:          d.color,
        active:         d.active,
        description:    d.description   ?? undefined,
        breakStart:     d.breakStart    ?? undefined,
        breakEnd:       d.breakEnd      ?? undefined,
        otStartsAfter:  d.otStartsAfter ?? undefined,
      },
    });
    revalidatePath("/shifts");
    return { ok: true, data: { id: shift.id } };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function updateShift(id: number, raw: unknown): Promise<ActionResult<{ id: number }>> {
  try {
    const parsed = ShiftInput.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors };
    }
    await guard("attendance.write");
    const { description, breakStart, breakEnd, otStartsAfter, ...rest } = parsed.data;
    await prisma.shift.update({
      where: { id },
      data: { ...rest, description, breakStart, breakEnd, otStartsAfter },
    });
    revalidatePath("/shifts");
    return { ok: true, data: { id } };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function deleteShift(id: number): Promise<ActionResult> {
  try {
    await guard("attendance.write");
    const count = await prisma.shiftAssignment.count({ where: { shiftId: id } });
    if (count > 0) {
      return { ok: false, error: `Cannot delete: ${count} assignment(s) exist. Remove assignments first.` };
    }
    await prisma.shift.delete({ where: { id } });
    revalidatePath("/shifts");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Shift Assignments ──────────────────────────────────────────

export type AssignmentRow = {
  id: number;
  shiftId: number;
  shiftName: string;
  shiftCode: string;
  shiftColor: string;
  employeeId: number;
  employeeCode: string | null;
  nameEn: string;
  nameKh: string;
  departmentName: string | null;
  positionName: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
};

export async function getShiftAssignments(params: {
  shiftId?: number;
  departmentId?: number;
  activeOnly?: boolean;
}): Promise<ActionResult<AssignmentRow[]>> {
  try {
    await guard("attendance.read");
    const today = new Date();
    const rows = await prisma.shiftAssignment.findMany({
      where: {
        ...(params.shiftId    ? { shiftId: params.shiftId } : {}),
        ...(params.departmentId ? { employee: { departmentId: params.departmentId } } : {}),
        ...(params.activeOnly ? {
          effectiveFrom: { lte: today },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
        } : {}),
      },
      include: {
        shift: { select: { name: true, code: true, color: true } },
        employee: {
          select: {
            id: true, employeeCode: true, nameEn: true, nameKh: true,
            department: { select: { name: true } },
            position:   { select: { name: true } },
          },
        },
      },
      orderBy: [{ effectiveFrom: "desc" }, { employee: { nameEn: "asc" } }],
    });
    return {
      ok: true,
      data: rows.map(r => ({
        id:            r.id,
        shiftId:       r.shiftId,
        shiftName:     r.shift.name,
        shiftCode:     r.shift.code,
        shiftColor:    r.shift.color,
        employeeId:    r.employeeId,
        employeeCode:  r.employee.employeeCode,
        nameEn:        r.employee.nameEn,
        nameKh:        r.employee.nameKh,
        departmentName: r.employee.department?.name ?? null,
        positionName:   r.employee.position?.name   ?? null,
        effectiveFrom:  r.effectiveFrom.toISOString().slice(0, 10),
        effectiveTo:    r.effectiveTo ? r.effectiveTo.toISOString().slice(0, 10) : null,
        notes:          r.notes,
      })),
    };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function saveShiftAssignment(raw: unknown): Promise<ActionResult<{ id: number }>> {
  try {
    const parsed = AssignmentInput.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors };
    }
    await guard("attendance.write");
    const { shiftId, employeeId, effectiveFrom, effectiveTo, notes } = parsed.data;

    const existing = await prisma.shiftAssignment.findFirst({
      where: { employeeId, effectiveFrom },
    });

    let rec;
    if (existing) {
      rec = await prisma.shiftAssignment.update({
        where: { id: existing.id },
        data: { shiftId, effectiveTo: effectiveTo ?? null, notes: notes ?? null },
      });
    } else {
      rec = await prisma.shiftAssignment.create({
        data: { shiftId, employeeId, effectiveFrom, effectiveTo: effectiveTo ?? null, notes: notes ?? null },
      });
    }
    revalidatePath("/shifts");
    return { ok: true, data: { id: rec.id } };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function deleteShiftAssignment(id: number): Promise<ActionResult> {
  try {
    await guard("attendance.write");
    await prisma.shiftAssignment.delete({ where: { id } });
    revalidatePath("/shifts");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function bulkAssignShiftToEmployees(params: {
  shiftId: number;
  employeeIds: number[];
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  notes?: string | null;
}): Promise<ActionResult<{ count: number }>> {
  try {
    await guard("attendance.write");
    const { shiftId, employeeIds, effectiveFrom, effectiveTo, notes } = params;

    await prisma.shiftAssignment.createMany({
      data: employeeIds.map(employeeId => ({
        shiftId, employeeId, effectiveFrom, effectiveTo: effectiveTo ?? null, notes: notes ?? null,
      })),
      skipDuplicates: true,
    });

    revalidatePath("/shifts");
    return { ok: true, data: { count: employeeIds.length } };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Shift summary for dashboard ────────────────────────────────

export type ShiftSummary = {
  totalShifts: number;
  activeShifts: number;
  totalAssigned: number;
  byShift: { shiftId: number; name: string; color: string; employeeCount: number }[];
};

export async function getShiftSummary(): Promise<ActionResult<ShiftSummary>> {
  try {
    await guard("attendance.read");
    const today = new Date();
    const [totalShifts, activeShifts, assignments] = await Promise.all([
      prisma.shift.count(),
      prisma.shift.count({ where: { active: true } }),
      prisma.shiftAssignment.findMany({
        where: {
          effectiveFrom: { lte: today },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
        },
        include: { shift: { select: { id: true, name: true, color: true } } },
      }),
    ]);

    const byShiftMap = new Map<number, { name: string; color: string; count: number }>();
    for (const a of assignments) {
      const prev = byShiftMap.get(a.shiftId) ?? { name: a.shift.name, color: a.shift.color, count: 0 };
      byShiftMap.set(a.shiftId, { ...prev, count: prev.count + 1 });
    }

    return {
      ok: true,
      data: {
        totalShifts,
        activeShifts,
        totalAssigned: assignments.length,
        byShift: Array.from(byShiftMap.entries()).map(([shiftId, v]) => ({
          shiftId, name: v.name, color: v.color, employeeCount: v.count,
        })),
      },
    };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Unexpected error";
}
