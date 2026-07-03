"use server";
// ZYSTEEL HR — Attendance & Overtime Server Actions.
// Attendance: bulk-upsert a period grid (arch §3.3, marks not timestamps).
// Overtime: log incidents; value derived via pure calc (arch §3.5).

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../lib/db";
import { guard } from "../lib/auth/session";
import { writeAudit } from "../lib/audit";
import { overtimeAmount, type OvertimeBand, type OvertimeMode } from "../lib/payroll/calc";
import type { ActionResult } from "./employees";

const Mark = z.enum(["PRESENT", "LEAVE", "ABSENT"]);

const AttendanceRow = z.object({
  employeeId: z.coerce.number().int().positive(),
  date: z.coerce.date(),
  am: Mark,
  pm: Mark,
  leaveType: z.enum(["ANNUAL", "SICK", "SPECIAL", "UNPAID", "PERMITTED"]).optional().nullable(),
  note: z.string().max(300).optional().nullable(),
});

const AttendanceBatch = z.object({
  rows: z.array(AttendanceRow).min(1).max(2000),
});

/**
 * Bulk upsert attendance. Each row is unique by (employeeId, date) so re-saving
 * a period overwrites cleanly. SUPERVISOR is department-scoped — we verify every
 * row's employee belongs to the actor's department before writing.
 */
export async function saveAttendance(raw: unknown): Promise<ActionResult<{ count: number }>> {
  try {
    const parsed = AttendanceBatch.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors };
    }
    const rows = parsed.data.rows;

    // Department scoping: resolve the departments of all referenced employees once.
    const empIds = [...new Set(rows.map((r) => r.employeeId))];
    const emps = await prisma.employee.findMany({
      where: { id: { in: empIds } },
      select: { id: true, departmentId: true },
    });
    const deptOf = new Map(emps.map((e) => [e.id, e.departmentId]));

    // Authorize against each distinct department the batch touches.
    const actor = await guard("attendance.write");
    if (actor.role === "SUPERVISOR") {
      for (const r of rows) {
        // re-check per row with the row's target department
        await guard("attendance.write", { targetDeptId: deptOf.get(r.employeeId) ?? null });
      }
    }

    const result = await prisma.$transaction(
      rows.map((r) =>
        prisma.attendanceDay.upsert({
          where: { employeeId_date: { employeeId: r.employeeId, date: r.date } },
          update: { am: r.am, pm: r.pm, leaveType: r.leaveType ?? undefined, note: r.note ?? undefined },
          create: {
            employeeId: r.employeeId, date: r.date, am: r.am, pm: r.pm,
            leaveType: r.leaveType ?? undefined, note: r.note ?? undefined,
          },
        })
      )
    );

    await writeAudit({
      userId: actor.id, action: "attendance.write", entityType: "AttendanceDay",
      entityId: `batch:${empIds.join(",")}`, after: { count: result.length },
    });
    revalidatePath("/attendance");
    return { ok: true, data: { count: result.length } };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function getAttendanceForPeriod(params: {
  startDate: Date; endDate: Date; departmentId?: number;
}): Promise<ActionResult<Awaited<ReturnType<typeof queryAttendance>>>> {
  try {
    await guard("attendance.read");
    const data = await queryAttendance(params);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

async function queryAttendance(params: { startDate: Date; endDate: Date; departmentId?: number }) {
  return prisma.attendanceDay.findMany({
    where: {
      date: { gte: params.startDate, lte: params.endDate },
      ...(params.departmentId ? { employee: { departmentId: params.departmentId } } : {}),
    },
    include: { employee: { select: { id: true, nameEn: true, nameKh: true, nameZh: true } } },
    orderBy: [{ employeeId: "asc" }, { date: "asc" }],
  });
}

// ── Overtime ──

const OvertimeInput = z.object({
  employeeId: z.coerce.number().int().positive(),
  date: z.coerce.date(),
  hours: z.coerce.number().positive().max(12),
  band: z.enum(["NORMAL_1_5", "NIGHT_2_0", "HOLIDAY_2_0"]),
  description: z.string().max(200).optional().nullable(),
});

export async function createOvertime(raw: unknown): Promise<ActionResult<{ id: string; amountUsd: number }>> {
  try {
    const parsed = OvertimeInput.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors };
    }
    const { employeeId, date, hours, band, description } = parsed.data;

    const emp = await prisma.employee.findUnique({
      where: { id: employeeId }, select: { dailyRateUsd: true, departmentId: true },
    });
    if (!emp) return { ok: false, error: "Employee not found" };

    const actor = await guard("overtime.create", { targetDeptId: emp.departmentId });

    // Value derived (arch §3.5) using the configured OT mode.
    const modeSetting = await prisma.setting.findUnique({ where: { key: "overtime_mode" } });
    const mode = (modeSetting?.value as OvertimeMode) ?? "FLAT_TIER";
    const amountUsd = overtimeAmount(Number(emp.dailyRateUsd), hours, band as OvertimeBand, mode);

    const entry = await prisma.overtimeEntry.create({
      data: { employeeId, date, hours, band: band as OvertimeBand, description: description ?? undefined, amountUsd },
    });
    await writeAudit({ userId: actor.id, action: "overtime.create", entityType: "OvertimeEntry", entityId: entry.id.toString(), after: entry });
    revalidatePath("/overtime");
    return { ok: true, data: { id: entry.id.toString(), amountUsd } };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

// ── Rich attendance fetch (includes dept / position / photo for summary views) ──

export type AttendanceDayFull = {
  id: string;
  employeeId: number;
  employee: {
    id: number; nameEn: string; nameKh: string; nameZh: string | null;
    photoUrl: string | null; departmentId: number | null; positionId: number | null;
  };
  date: string;  // "YYYY-MM-DD"
  am: "PRESENT" | "LEAVE" | "ABSENT";
  pm: "PRESENT" | "LEAVE" | "ABSENT";
  leaveType: string | null;
  note: string | null;
};

export async function getAttendancePeriodFull(params: {
  startDate: Date; endDate: Date; departmentId?: number;
}): Promise<ActionResult<AttendanceDayFull[]>> {
  try {
    await guard("attendance.read");
    const rows = await prisma.attendanceDay.findMany({
      where: {
        date: { gte: params.startDate, lte: params.endDate },
        ...(params.departmentId ? { employee: { departmentId: params.departmentId } } : {}),
      },
      include: {
        employee: {
          select: {
            id: true, nameEn: true, nameKh: true, nameZh: true,
            photoUrl: true, departmentId: true, positionId: true,
          },
        },
      },
      orderBy: [{ employeeId: "asc" }, { date: "asc" }],
    });
    return {
      ok: true,
      data: rows.map(r => ({
        id: r.id.toString(),
        employeeId: r.employeeId,
        employee: {
          id: r.employee.id,
          nameEn: r.employee.nameEn,
          nameKh: r.employee.nameKh,
          nameZh: r.employee.nameZh,
          photoUrl: r.employee.photoUrl,
          departmentId: r.employee.departmentId,
          positionId: r.employee.positionId,
        },
        date: new Date(r.date).toISOString().slice(0, 10),
        am: r.am,
        pm: r.pm,
        leaveType: r.leaveType ?? null,
        note: r.note ?? null,
      })),
    };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function deleteAttendanceRecord(id: string): Promise<ActionResult> {
  try {
    const actor = await guard("attendance.write");
    const record = await prisma.attendanceDay.findUnique({
      where: { id: BigInt(id) },
      include: { employee: { select: { departmentId: true } } },
    });
    if (!record) return { ok: false, error: "Record not found." };
    if (actor.role === "SUPERVISOR") {
      await guard("attendance.write", { targetDeptId: record.employee.departmentId });
    }
    await prisma.attendanceDay.delete({ where: { id: BigInt(id) } });
    await writeAudit({ userId: actor.id, action: "attendance.delete", entityType: "AttendanceDay", entityId: id });
    revalidatePath("/attendance");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

function errMsg(e: unknown): string {
  if (e instanceof Error) {
    if (e.message === "Not authenticated") redirect("/login");
    if (e.name === "ForbiddenError") return "You do not have permission for this action.";
    return e.message;
  }
  return "Unexpected error";
}
