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
import { todayICT, startOfTodayICT } from "@/lib/utils/date";

const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;

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
      rows.map((r) => {
        const ds = marksToStatus(r.am, r.pm);
        return prisma.attendanceDay.upsert({
          where: { employeeId_date: { employeeId: r.employeeId, date: r.date } },
          update: { am: r.am, pm: r.pm, dailyStatus: ds, leaveType: r.leaveType ?? undefined, note: r.note ?? undefined },
          create: {
            employeeId: r.employeeId, date: r.date, am: r.am, pm: r.pm, dailyStatus: ds,
            leaveType: r.leaveType ?? undefined, note: r.note ?? undefined,
          },
        });
      })
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

// ── Daily attendance status config ──

export const DAILY_STATUS_LIST = [
  "PRESENT", "LATE", "ABSENT", "SICK_LEAVE", "ANNUAL_LEAVE",
  "PERSONAL_LEAVE", "BUSINESS_TRIP", "WORK_FROM_HOME", "HALF_DAY", "HOLIDAY",
] as const;

export type DailyStatusValue = (typeof DAILY_STATUS_LIST)[number];

export const DAILY_STATUS_LABEL: Record<DailyStatusValue, string> = {
  PRESENT:       "Present",
  LATE:          "Late",
  ABSENT:        "Absent",
  SICK_LEAVE:    "Sick Leave",
  ANNUAL_LEAVE:  "Annual Leave",
  PERSONAL_LEAVE:"Personal Leave",
  BUSINESS_TRIP: "Business Trip",
  WORK_FROM_HOME:"Work From Home",
  HALF_DAY:      "Half Day",
  HOLIDAY:       "Holiday",
};

// ── Company policy defaults (configurable via settings in future) ──

const WORK_START_HOUR = 8;   // 08:00
const WORK_END_HOUR   = 17;  // 17:00
const LATE_GRACE_MIN  = 15;  // minutes grace before "late"
const OT_START_HOUR   = 17;  // overtime starts after 17:00

function calcWorkingHours(checkIn: Date, checkOut: Date): number {
  const diffMs = checkOut.getTime() - checkIn.getTime();
  return Math.max(0, Math.round((diffMs / 3_600_000) * 100) / 100);
}

function calcOvertimeHours(checkOut: Date): number {
  const ictCheckOut = new Date(checkOut.getTime() + ICT_OFFSET_MS);
  const ictOtStart = new Date(ictCheckOut);
  ictOtStart.setUTCHours(OT_START_HOUR, 0, 0, 0);
  if (ictCheckOut <= ictOtStart) return 0;
  return Math.round(((ictCheckOut.getTime() - ictOtStart.getTime()) / 3_600_000) * 100) / 100;
}

function calcLateMinutes(checkIn: Date): number {
  const ictCheckIn = new Date(checkIn.getTime() + ICT_OFFSET_MS);
  const ictExpected = new Date(ictCheckIn);
  ictExpected.setUTCHours(WORK_START_HOUR, LATE_GRACE_MIN, 0, 0);
  if (ictCheckIn <= ictExpected) return 0;
  return Math.round((ictCheckIn.getTime() - ictExpected.getTime()) / 60_000);
}

// Map AM/PM marks → DailyStatus for cross-system consistency
function marksToStatus(am: "PRESENT" | "LEAVE" | "ABSENT", pm: "PRESENT" | "LEAVE" | "ABSENT"): DailyStatusValue {
  if (am === "PRESENT" && pm === "PRESENT") return "PRESENT";
  if (am === "PRESENT" && pm === "ABSENT")  return "HALF_DAY";
  if (am === "LEAVE"   || pm === "LEAVE")   return "ANNUAL_LEAVE";
  return "ABSENT";
}

// Map DailyStatus → AttendanceMark pair (am/pm) for backward compat
function statusToMarks(status: DailyStatusValue): { am: "PRESENT" | "LEAVE" | "ABSENT"; pm: "PRESENT" | "LEAVE" | "ABSENT" } {
  if (status === "PRESENT" || status === "LATE" || status === "BUSINESS_TRIP" || status === "WORK_FROM_HOME") {
    return { am: "PRESENT", pm: "PRESENT" };
  }
  if (status === "HALF_DAY") return { am: "PRESENT", pm: "ABSENT" };
  if (status === "ABSENT") return { am: "ABSENT", pm: "ABSENT" };
  return { am: "LEAVE", pm: "LEAVE" };
}

// ── Daily record schema ──

const DailyRecordInput = z.object({
  employeeId:  z.coerce.number().int().positive(),
  date:        z.coerce.date(),
  dailyStatus: z.enum(DAILY_STATUS_LIST),
  checkIn:     z.string().optional().nullable(),
  checkOut:    z.string().optional().nullable(),
  shiftType:   z.enum(["DAY", "AFTERNOON", "NIGHT"]).optional().nullable(),
  note:        z.string().max(300).optional().nullable(),
});

const BulkDailyInput = z.object({
  rows: z.array(DailyRecordInput).min(1).max(2000),
});

// ── Get all employees + their attendance record for a given date ──

export type DailyAttendanceRow = {
  employeeId:   number;
  employeeCode: string | null;
  nameEn:       string;
  nameKh:       string;
  photoUrl:     string | null;
  departmentId: number | null;
  departmentName: string | null;
  positionId:   number | null;
  positionName: string | null;
  shift:        string | null;
  recordId:     string | null;
  dailyStatus:  DailyStatusValue | null;
  checkIn:      string | null;
  checkOut:     string | null;
  workingHours: number | null;
  overtimeHours: number | null;
  lateMinutes:  number | null;
  shiftType:    string | null;
  note:         string | null;
};

export async function getDailyAttendance(params: {
  date: Date;
  departmentId?: number;
  positionId?: number;
  statusFilter?: DailyStatusValue | "";
  search?: string;
}): Promise<ActionResult<DailyAttendanceRow[]>> {
  try {
    await guard("attendance.read");
    const { date, departmentId, positionId, statusFilter, search } = params;

    const employees = await prisma.employee.findMany({
      where: {
        status: "ACTIVE",
        ...(departmentId ? { departmentId } : {}),
        ...(positionId   ? { positionId }   : {}),
        ...(search ? {
          OR: [
            { nameEn: { contains: search, mode: "insensitive" } },
            { nameKh: { contains: search } },
            { employeeCode: { contains: search, mode: "insensitive" } },
          ],
        } : {}),
      },
      orderBy: [{ department: { name: "asc" } }, { nameEn: "asc" }],
      select: {
        id: true, employeeCode: true, nameEn: true, nameKh: true,
        photoUrl: true, departmentId: true, positionId: true, shift: true,
        department: { select: { name: true } },
        position:   { select: { name: true } },
      },
    });

    const empIds = employees.map(e => e.id);
    const dayOnly = new Date(date);
    dayOnly.setUTCHours(0, 0, 0, 0);

    const records = await prisma.attendanceDay.findMany({
      where: {
        employeeId: { in: empIds },
        date: dayOnly,
      },
    });

    const recByEmp = new Map(records.map(r => [r.employeeId, r]));

    const rows: DailyAttendanceRow[] = employees.map(e => {
      const rec = recByEmp.get(e.id);
      let workingHours: number | null = null;
      let overtimeHours: number | null = null;
      let lateMinutes: number | null = null;

      if (rec?.checkIn && rec?.checkOut) {
        workingHours  = calcWorkingHours(rec.checkIn, rec.checkOut);
        overtimeHours = calcOvertimeHours(rec.checkOut);
      }
      if (rec?.checkIn) {
        lateMinutes = calcLateMinutes(rec.checkIn);
      }

      return {
        employeeId:    e.id,
        employeeCode:  e.employeeCode,
        nameEn:        e.nameEn,
        nameKh:        e.nameKh,
        photoUrl:      e.photoUrl,
        departmentId:  e.departmentId,
        departmentName: e.department?.name ?? null,
        positionId:    e.positionId,
        positionName:  e.position?.name ?? null,
        shift:         e.shift,
        recordId:      rec ? rec.id.toString() : null,
        dailyStatus:   (rec?.dailyStatus as DailyStatusValue | null) ?? null,
        checkIn:       rec?.checkIn ? rec.checkIn.toISOString() : null,
        checkOut:      rec?.checkOut ? rec.checkOut.toISOString() : null,
        workingHours,
        overtimeHours,
        lateMinutes,
        shiftType:     rec?.shiftType ?? null,
        note:          rec?.note ?? null,
      };
    });

    const filtered = statusFilter
      ? rows.filter(r => r.dailyStatus === statusFilter)
      : rows;

    return { ok: true, data: filtered };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Save a single daily attendance record ──

export async function saveDailyRecord(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = DailyRecordInput.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors };
    }
    const { employeeId, date, dailyStatus, checkIn, checkOut, shiftType, note } = parsed.data;

    const emp = await prisma.employee.findUnique({
      where: { id: employeeId }, select: { departmentId: true },
    });
    if (!emp) return { ok: false, error: "Employee not found" };

    const actor = await guard("attendance.write", { targetDeptId: emp.departmentId });

    const checkInDate  = checkIn  ? new Date(checkIn)  : undefined;
    const checkOutDate = checkOut ? new Date(checkOut)  : undefined;

    if (checkInDate && checkOutDate && checkOutDate <= checkInDate) {
      return { ok: false, error: "Check-out time must be after check-in time." };
    }

    const todayStr = todayICT();
    if (date.toISOString().slice(0, 10) > todayStr && actor.role !== "OWNER" && actor.role !== "HR_MANAGER") {
      return { ok: false, error: "Future attendance entries are not permitted for your role." };
    }

    const marks = statusToMarks(dailyStatus);

    const rec = await prisma.attendanceDay.upsert({
      where: { employeeId_date: { employeeId, date } },
      update: {
        dailyStatus, checkIn: checkInDate, checkOut: checkOutDate,
        shiftType: shiftType ?? undefined, note: note ?? undefined,
        am: marks.am, pm: marks.pm,
      },
      create: {
        employeeId, date, dailyStatus, checkIn: checkInDate, checkOut: checkOutDate,
        shiftType: shiftType ?? undefined, note: note ?? undefined,
        am: marks.am, pm: marks.pm,
      },
    });

    await writeAudit({
      userId: actor.id, action: "attendance.write", entityType: "AttendanceDay",
      entityId: rec.id.toString(), after: { dailyStatus, checkIn, checkOut },
    });
    revalidatePath("/attendance");
    revalidatePath("/attendance/daily");
    return { ok: true, data: { id: rec.id.toString() } };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Bulk save daily attendance records ──

export async function bulkSaveDailyAttendance(raw: unknown): Promise<ActionResult<{ count: number }>> {
  try {
    const parsed = BulkDailyInput.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors };
    }
    const { rows } = parsed.data;

    const empIds = [...new Set(rows.map(r => r.employeeId))];
    const emps = await prisma.employee.findMany({
      where: { id: { in: empIds } },
      select: { id: true, departmentId: true },
    });
    const deptOf = new Map(emps.map(e => [e.id, e.departmentId]));

    const actor = await guard("attendance.write");
    if (actor.role === "SUPERVISOR") {
      for (const r of rows) {
        await guard("attendance.write", { targetDeptId: deptOf.get(r.employeeId) ?? null });
      }
    }

    const todayStr = todayICT();

    for (const r of rows) {
      const ci = r.checkIn  ? new Date(r.checkIn)  : null;
      const co = r.checkOut ? new Date(r.checkOut) : null;
      if (ci && co && co <= ci) {
        return { ok: false, error: `Check-out must be after check-in (employee #${r.employeeId}).` };
      }
      if (r.date.toISOString().slice(0, 10) > todayStr && actor.role !== "OWNER" && actor.role !== "HR_MANAGER") {
        return { ok: false, error: "Future attendance entries are not permitted for your role." };
      }
    }

    const ops = rows.map(r => {
      const checkInDate  = r.checkIn  ? new Date(r.checkIn)  : undefined;
      const checkOutDate = r.checkOut ? new Date(r.checkOut) : undefined;
      const marks = statusToMarks(r.dailyStatus);
      return prisma.attendanceDay.upsert({
        where: { employeeId_date: { employeeId: r.employeeId, date: r.date } },
        update: {
          dailyStatus: r.dailyStatus, checkIn: checkInDate, checkOut: checkOutDate,
          shiftType: r.shiftType ?? undefined, note: r.note ?? undefined,
          am: marks.am, pm: marks.pm,
        },
        create: {
          employeeId: r.employeeId, date: r.date, dailyStatus: r.dailyStatus,
          checkIn: checkInDate, checkOut: checkOutDate,
          shiftType: r.shiftType ?? undefined, note: r.note ?? undefined,
          am: marks.am, pm: marks.pm,
        },
      });
    });

    const result = await prisma.$transaction(ops);

    await writeAudit({
      userId: actor.id, action: "attendance.write", entityType: "AttendanceDay",
      entityId: `bulk:${empIds.join(",")}`, after: { count: result.length },
    });
    revalidatePath("/attendance");
    revalidatePath("/attendance/daily");
    return { ok: true, data: { count: result.length } };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Today's summary for dashboard widget ──

export type TodaySummary = {
  date: string;
  total: number;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  attendanceRate: number | null;
  totalOvertimeHours: number;
};

export async function getAttendanceSummaryToday(): Promise<ActionResult<TodaySummary>> {
  try {
    await guard("attendance.read");
    const today = startOfTodayICT();
    const todayEnd = new Date(today.getTime() + 86_400_000 - 1);

    const [totalActive, records] = await Promise.all([
      prisma.employee.count({ where: { status: "ACTIVE" } }),
      prisma.attendanceDay.findMany({
        where: { date: { gte: today, lte: todayEnd } },
        select: { dailyStatus: true, checkIn: true, checkOut: true },
      }),
    ]);

    let present = 0, late = 0, absent = 0, onLeave = 0;
    let totalOtMs = 0;

    for (const r of records) {
      const s = r.dailyStatus as DailyStatusValue | null;
      if (s === "PRESENT") present++;
      else if (s === "LATE") late++;
      else if (s === "ABSENT") absent++;
      else if (
        s === "SICK_LEAVE" || s === "ANNUAL_LEAVE" || s === "PERSONAL_LEAVE" ||
        s === "BUSINESS_TRIP" || s === "WORK_FROM_HOME" || s === "HALF_DAY" || s === "HOLIDAY"
      ) onLeave++;

      if (r.checkIn && r.checkOut) {
        const ictCheckOut = new Date(r.checkOut.getTime() + ICT_OFFSET_MS);
        const ictOtStart = new Date(ictCheckOut);
        ictOtStart.setUTCHours(OT_START_HOUR, 0, 0, 0);
        if (ictCheckOut > ictOtStart) totalOtMs += ictCheckOut.getTime() - ictOtStart.getTime();
      }
    }

    const recorded = records.length;
    const attendanceRate = totalActive > 0
      ? Math.round(((present + late) / totalActive) * 100)
      : null;

    return {
      ok: true,
      data: {
        date: today.toISOString().slice(0, 10),
        total: totalActive,
        present,
        late,
        absent,
        onLeave,
        attendanceRate,
        totalOvertimeHours: Math.round((totalOtMs / 3_600_000) * 10) / 10,
      },
    };
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
