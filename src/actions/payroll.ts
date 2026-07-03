"use server";
// ZYSTEEL HR — Payroll Server Actions (Stage 3 + F6 period management).
// Generates a run: resolve attendance → sum OT in window → snapshot payslips
// (arch §3.1, immutable once locked). Re-runnable until locked.

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "../lib/db";
import { guard } from "../lib/auth/session";
import { writeAudit } from "../lib/audit";
import { runPayroll, payrollToCsv, type EmployeePeriodInputs } from "../lib/payroll/run";
import { summarize, type AttendanceMark } from "../lib/payroll/attendance";
import type { ActionResult } from "./employees";

// ─── Period management ─────────────────────────────────────────────────────────

const PeriodInput = z.object({
  year:        z.coerce.number().int().min(2020).max(2099),
  month:       z.coerce.number().int().min(1).max(12),
  half:        z.coerce.number().int().min(1).max(2),
  startDate:   z.coerce.date(),
  endDate:     z.coerce.date(),
  workingDays: z.coerce.number().int().min(0).max(31),
  name:        z.string().max(100).optional().nullable(),
  payrollDate: z.coerce.date().optional().nullable(),
  notes:       z.string().max(500).optional().nullable(),
});

const PeriodUpdateInput = z.object({
  name:        z.string().max(100).optional().nullable(),
  payrollDate: z.coerce.date().optional().nullable(),
  notes:       z.string().max(500).optional().nullable(),
  workingDays: z.coerce.number().int().min(0).max(31).optional(),
  startDate:   z.coerce.date().optional(),
  endDate:     z.coerce.date().optional(),
});

export type PeriodMgmtRow = {
  id: number;
  year: number;
  month: number;
  half: number;
  startDate: string;
  endDate: string;
  workingDays: number;
  locked: boolean;
  name: string | null;
  payrollDate: string | null;
  notes: string | null;
  createdAt: string;
  payslipCount: number;
};

function periodLabel(p: { name?: string | null; year: number; month: number; half: number }): string {
  if (p.name) return p.name;
  return `${p.year}-${String(p.month).padStart(2, "0")} ${p.half === 1 ? "1st Half" : "2nd Half"}`;
}

export async function listPeriodsForManagement(): Promise<ActionResult<PeriodMgmtRow[]>> {
  try {
    await guard("payroll.read");
    const rows = await prisma.payPeriod.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }, { half: "desc" }],
      include: { _count: { select: { payslips: true } } },
    });
    return {
      ok: true,
      data: rows.map((p) => ({
        id: p.id,
        year: p.year,
        month: p.month,
        half: p.half,
        startDate: p.startDate.toISOString(),
        endDate: p.endDate.toISOString(),
        workingDays: p.workingDays,
        locked: p.locked,
        name: p.name,
        payrollDate: p.payrollDate ? p.payrollDate.toISOString() : null,
        notes: p.notes,
        createdAt: p.createdAt.toISOString(),
        payslipCount: p._count.payslips,
      })),
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createPayPeriod(raw: unknown): Promise<ActionResult<{ id: number }>> {
  try {
    const actor = await guard("payroll.run");
    const parsed = PeriodInput.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
    const { year, month, half, startDate, endDate, workingDays, name, payrollDate, notes } = parsed.data;

    if (endDate <= startDate) return { ok: false, error: "End date must be after start date." };

    // Overlap check — no two periods may share any calendar days
    const overlap = await prisma.payPeriod.findFirst({
      where: { startDate: { lte: endDate }, endDate: { gte: startDate } },
    });
    if (overlap) {
      return { ok: false, error: `Date range overlaps with existing period: ${periodLabel(overlap)} (${overlap.startDate.toISOString().slice(0, 10)} – ${overlap.endDate.toISOString().slice(0, 10)}).` };
    }

    const period = await prisma.payPeriod.create({
      data: { year, month, half, startDate, endDate, workingDays, name: name ?? null, payrollDate: payrollDate ?? null, notes: notes ?? null },
    });

    await writeAudit({ userId: actor.id, action: "payroll.period.create", entityType: "PayPeriod", entityId: period.id, after: { year, month, half } });
    revalidatePath("/payroll");
    return { ok: true, data: { id: period.id } };
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { ok: false, error: "A period for this year/month/half already exists." };
    }
    return { ok: false, error: errMsg(e) };
  }
}

export async function updatePayPeriod(id: number, raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const actor = await guard("payroll.run");
    const period = await prisma.payPeriod.findUnique({ where: { id } });
    if (!period) return { ok: false, error: "Pay period not found." };

    const parsed = PeriodUpdateInput.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
    const { name, payrollDate, notes, workingDays, startDate, endDate } = parsed.data;

    // Financial fields (dates, workingDays) cannot be changed on a locked period
    const changingFinancials = startDate !== undefined || endDate !== undefined || workingDays !== undefined;
    if (period.locked && changingFinancials) {
      return { ok: false, error: "Cannot change dates or working days on a locked period. Unlock it first." };
    }

    if (startDate && endDate && endDate <= startDate) return { ok: false, error: "End date must be after start date." };

    // Overlap check if dates are changing
    if (startDate || endDate) {
      const sd = startDate ?? period.startDate;
      const ed = endDate ?? period.endDate;
      const overlap = await prisma.payPeriod.findFirst({
        where: { id: { not: id }, startDate: { lte: ed }, endDate: { gte: sd } },
      });
      if (overlap) {
        return { ok: false, error: `Dates overlap with: ${periodLabel(overlap)}.` };
      }
    }

    const before = { name: period.name, payrollDate: period.payrollDate, notes: period.notes, workingDays: period.workingDays };
    await prisma.payPeriod.update({
      where: { id },
      data: {
        name: name ?? null,
        payrollDate: payrollDate ?? null,
        notes: notes ?? null,
        ...(workingDays !== undefined && !period.locked ? { workingDays } : {}),
        ...(startDate && !period.locked ? { startDate } : {}),
        ...(endDate && !period.locked ? { endDate } : {}),
      },
    });

    await writeAudit({ userId: actor.id, action: "payroll.period.update", entityType: "PayPeriod", entityId: id, before, after: { name, payrollDate, notes } });
    revalidatePath("/payroll");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function unlockPeriod(id: number): Promise<ActionResult<undefined>> {
  try {
    const actor = await guard("payroll.lock");
    const period = await prisma.payPeriod.findUnique({ where: { id } });
    if (!period) return { ok: false, error: "Pay period not found." };
    if (!period.locked) return { ok: false, error: "Period is already open." };

    await prisma.payPeriod.update({ where: { id }, data: { locked: false } });
    await writeAudit({ userId: actor.id, action: "payroll.unlock", entityType: "PayPeriod", entityId: id, before: { locked: true }, after: { locked: false } });
    revalidatePath("/payroll");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

// ─── New F7 types ──────────────────────────────────────────────────────────────

export type PayrollPreviewRow = {
  employeeId: number;
  nameEn: string;
  nameKh: string;
  departmentName: string | null;
  dailyRateUsd: number;
  daysWorked: number;
  hasAttendance: boolean;
  overtimeUsd: number;
  bonusUsd: number;
  deductionUsd: number;
  estimatedGrossUsd: number;
  estimatedNetUsd: number;
};

export type PayslipHistoryRow = {
  id: string;
  periodId: number;
  periodLabel: string;
  employeeId: number;
  nameEn: string;
  nameKh: string;
  departmentName: string | null;
  daysWorked: number;
  dailyRateUsd: number;
  baseUsd: number;
  overtimeUsd: number;
  bonusUsd: number;
  deductionUsd: number;
  grossUsd: number;
  netUsd: number;
  netKhr: number;
  finalized: boolean;
  createdAt: string;
};

export type PayslipDetailRow = {
  id: string;
  periodId: number;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  employeeId: number;
  nameEn: string;
  nameKh: string;
  nameZh: string | null;
  employeeCode: string | null;
  departmentName: string | null;
  positionName: string | null;
  daysWorked: number;
  dailyRateUsd: number;
  baseUsd: number;
  overtimeUsd: number;
  bonusUsd: number;
  deductionUsd: number;
  grossUsd: number;
  netUsd: number;
  netKhr: number;
  exchangeRate: number;
  breakdown: unknown;
  finalized: boolean;
  createdAt: string;
};

/** Preview payroll for a period without writing — shows attendance + adjustments per employee. */
export async function getPayrollPreview(periodId: number): Promise<ActionResult<PayrollPreviewRow[]>> {
  try {
    await guard("payroll.read");
    const period = await prisma.payPeriod.findUnique({ where: { id: periodId } });
    if (!period) return { ok: false, error: "Period not found" };

    const [employees, attendance, overtime, adjustments, unpaidLeaves] = await Promise.all([
      prisma.employee.findMany({
        where: { status: "ACTIVE" },
        include: { department: { select: { name: true } } },
        orderBy: [{ departmentId: "asc" }, { nameEn: "asc" }],
      }),
      prisma.attendanceDay.findMany({ where: { date: { gte: period.startDate, lte: period.endDate } } }),
      prisma.overtimeEntry.findMany({ where: { date: { gte: period.startDate, lte: period.endDate }, status: "APPROVED" } }),
      prisma.payrollAdjustment.findMany({ where: { periodId } }),
      prisma.leaveRequest.findMany({
        where: { status: "APPROVED", type: "UNPAID", startDate: { lte: period.endDate }, endDate: { gte: period.startDate } },
        select: { employeeId: true, startDate: true, endDate: true, halfDay: true },
      }),
    ]);

    const marksByEmp = new Map<number, { am: AttendanceMark; pm: AttendanceMark }[]>();
    for (const a of attendance) {
      const arr = marksByEmp.get(a.employeeId) ?? [];
      arr.push({ am: a.am as AttendanceMark, pm: a.pm as AttendanceMark });
      marksByEmp.set(a.employeeId, arr);
    }
    const otByEmp = new Map<number, number>();
    for (const o of overtime) {
      otByEmp.set(o.employeeId, round2((otByEmp.get(o.employeeId) ?? 0) + Number(o.amountUsd)));
    }
    const adjMap = new Map(adjustments.map((a) => [a.employeeId, { bonus: Number(a.bonusUsd), deduction: Number(a.deductionUsd) }]));
    const unpaidMap = new Map<number, number>();
    for (const l of unpaidLeaves) {
      const lo = new Date(Math.max(l.startDate.getTime(), period.startDate.getTime()));
      const hi = new Date(Math.min(l.endDate.getTime(), period.endDate.getTime()));
      const days = l.halfDay ? 0.5 : Math.round((hi.getTime() - lo.getTime()) / 86400000) + 1;
      unpaidMap.set(l.employeeId, (unpaidMap.get(l.employeeId) ?? 0) + days);
    }

    return {
      ok: true,
      data: employees.map((e) => {
        const marks = marksByEmp.get(e.id) ?? [];
        const t = summarize(marks);
        const adj = adjMap.get(e.id);
        const unpaidDays = unpaidMap.get(e.id) ?? 0;
        const unpaidDeduction = round2(unpaidDays * Number(e.dailyRateUsd));
        const bonusUsd = adj?.bonus ?? 0;
        const deductionUsd = round2((adj?.deduction ?? 0) + unpaidDeduction);
        const baseUsd = round2(Number(e.dailyRateUsd) * t.present);
        const overtimeUsd = otByEmp.get(e.id) ?? 0;
        const estimatedGrossUsd = round2(baseUsd + overtimeUsd + bonusUsd);
        const estimatedNetUsd = round2(estimatedGrossUsd - deductionUsd);
        return {
          employeeId: e.id,
          nameEn: e.nameEn,
          nameKh: e.nameKh,
          departmentName: e.department?.name ?? null,
          dailyRateUsd: Number(e.dailyRateUsd),
          daysWorked: t.present,
          hasAttendance: marksByEmp.has(e.id),
          overtimeUsd,
          bonusUsd,
          deductionUsd,
          estimatedGrossUsd,
          estimatedNetUsd,
        };
      }),
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Batch-save per-employee bonus/deduction adjustments for a period. */
export async function savePayrollAdjustments(
  periodId: number,
  items: { employeeId: number; bonusUsd: number; deductionUsd: number; note: string }[]
): Promise<ActionResult<undefined>> {
  try {
    const actor = await guard("payroll.run");
    const period = await prisma.payPeriod.findUnique({ where: { id: periodId } });
    if (!period) return { ok: false, error: "Period not found." };
    if (period.locked) return { ok: false, error: "Cannot adjust a locked period." };

    await prisma.$transaction(
      items.map((item) =>
        prisma.payrollAdjustment.upsert({
          where: { periodId_employeeId: { periodId, employeeId: item.employeeId } },
          update: { bonusUsd: item.bonusUsd, deductionUsd: item.deductionUsd, note: item.note || null },
          create: { periodId, employeeId: item.employeeId, bonusUsd: item.bonusUsd, deductionUsd: item.deductionUsd, note: item.note || null },
        })
      )
    );

    await writeAudit({ userId: actor.id, action: "payroll.adjustments.save", entityType: "PayPeriod", entityId: periodId, after: { count: items.length } });
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Fetch a single payslip with full context for printing. */
export async function getPayslipDetail(id: string): Promise<ActionResult<PayslipDetailRow>> {
  try {
    await guard("payroll.read");
    const slip = await prisma.payslip.findUnique({
      where: { id: BigInt(id) },
      include: {
        employee: {
          select: {
            nameEn: true, nameKh: true, nameZh: true, employeeCode: true,
            department: { select: { name: true } },
            position: { select: { name: true } },
          },
        },
        period: { select: { year: true, month: true, half: true, name: true, startDate: true, endDate: true } },
      },
    });
    if (!slip) return { ok: false, error: "Payslip not found." };

    const p = slip.period;
    const label = p.name ?? `${p.year}-${String(p.month).padStart(2, "0")} ${p.half === 1 ? "1st Half" : "2nd Half"}`;

    return {
      ok: true,
      data: {
        id: String(slip.id),
        periodId: slip.periodId,
        periodLabel: label,
        periodStart: slip.period.startDate.toISOString(),
        periodEnd: slip.period.endDate.toISOString(),
        employeeId: slip.employeeId,
        nameEn: slip.employee.nameEn,
        nameKh: slip.employee.nameKh,
        nameZh: slip.employee.nameZh ?? null,
        employeeCode: slip.employee.employeeCode ?? null,
        departmentName: slip.employee.department?.name ?? null,
        positionName: slip.employee.position?.name ?? null,
        daysWorked: Number(slip.daysWorked),
        dailyRateUsd: Number(slip.dailyRateUsd),
        baseUsd: Number(slip.baseUsd),
        overtimeUsd: Number(slip.overtimeUsd),
        bonusUsd: Number(slip.bonusUsd),
        deductionUsd: Number(slip.deductionUsd),
        grossUsd: Number(slip.grossUsd),
        netUsd: Number(slip.netUsd),
        netKhr: Number(slip.netKhr),
        exchangeRate: Number(slip.exchangeRate),
        breakdown: slip.breakdown,
        finalized: slip.finalized,
        createdAt: slip.createdAt.toISOString(),
      },
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** List payslips across all periods with optional filters. */
export async function listPayrollHistory(opts?: {
  employeeId?: number;
  periodId?: number;
  departmentId?: number;
  finalized?: boolean;
}): Promise<ActionResult<PayslipHistoryRow[]>> {
  try {
    await guard("payroll.read");
    const slips = await prisma.payslip.findMany({
      where: {
        ...(opts?.employeeId ? { employeeId: opts.employeeId } : {}),
        ...(opts?.periodId ? { periodId: opts.periodId } : {}),
        ...(opts?.finalized !== undefined ? { finalized: opts.finalized } : {}),
        ...(opts?.departmentId ? { employee: { departmentId: opts.departmentId } } : {}),
      },
      include: {
        employee: {
          select: { nameEn: true, nameKh: true, department: { select: { name: true } } },
        },
        period: { select: { year: true, month: true, half: true, name: true } },
      },
      orderBy: [{ periodId: "desc" }, { employeeId: "asc" }],
      take: 500,
    });

    return {
      ok: true,
      data: slips.map((s) => {
        const p = s.period;
        const label = p.name ?? `${p.year}-${String(p.month).padStart(2, "0")} ${p.half === 1 ? "1st Half" : "2nd Half"}`;
        return {
          id: String(s.id),
          periodId: s.periodId,
          periodLabel: label,
          employeeId: s.employeeId,
          nameEn: s.employee.nameEn,
          nameKh: s.employee.nameKh,
          departmentName: s.employee.department?.name ?? null,
          daysWorked: Number(s.daysWorked),
          dailyRateUsd: Number(s.dailyRateUsd),
          baseUsd: Number(s.baseUsd),
          overtimeUsd: Number(s.overtimeUsd),
          bonusUsd: Number(s.bonusUsd),
          deductionUsd: Number(s.deductionUsd),
          grossUsd: Number(s.grossUsd),
          netUsd: Number(s.netUsd),
          netKhr: Number(s.netKhr),
          finalized: s.finalized,
          createdAt: s.createdAt.toISOString(),
        };
      }),
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Generate (or regenerate) draft payslips for a period. Owner/HR only. */
export async function runPayrollForPeriod(periodId: number): Promise<ActionResult<{ count: number; grossUsd: number }>> {
  try {
    const actor = await guard("payroll.run");

    const period = await prisma.payPeriod.findUnique({ where: { id: periodId } });
    if (!period) return { ok: false, error: "Pay period not found" };
    if (period.locked) return { ok: false, error: "Period is locked. Unlock to re-run, or post an adjustment." };

    const rateSetting = await prisma.setting.findUnique({ where: { key: "exchange_rate" } });
    const exchangeRate = Number(rateSetting?.value ?? 4100);

    // Active employees + attendance + OT + adjustments + UNPAID leaves, in parallel.
    const [employees, attendance, overtime, adjustments, unpaidLeaves] = await Promise.all([
      prisma.employee.findMany({ where: { status: "ACTIVE" } }),
      prisma.attendanceDay.findMany({
        where: { date: { gte: period.startDate, lte: period.endDate } },
      }),
      prisma.overtimeEntry.findMany({
        where: { date: { gte: period.startDate, lte: period.endDate }, status: "APPROVED" },
      }),
      prisma.payrollAdjustment.findMany({ where: { periodId } }),
      prisma.leaveRequest.findMany({
        where: { status: "APPROVED", type: "UNPAID", startDate: { lte: period.endDate }, endDate: { gte: period.startDate } },
        select: { employeeId: true, startDate: true, endDate: true, halfDay: true },
      }),
    ]);

    // Resolve days worked per employee from the marks.
    const marksByEmp = new Map<number, { am: AttendanceMark; pm: AttendanceMark }[]>();
    for (const a of attendance) {
      const arr = marksByEmp.get(a.employeeId) ?? [];
      arr.push({ am: a.am as AttendanceMark, pm: a.pm as AttendanceMark });
      marksByEmp.set(a.employeeId, arr);
    }
    const otByEmp = new Map<number, number>();
    for (const o of overtime) {
      otByEmp.set(o.employeeId, Math.round(((otByEmp.get(o.employeeId) ?? 0) + Number(o.amountUsd)) * 100) / 100);
    }
    const adjMap = new Map(adjustments.map((a) => [a.employeeId, { bonus: Number(a.bonusUsd), deduction: Number(a.deductionUsd) }]));
    const unpaidMap = new Map<number, number>();
    for (const l of unpaidLeaves) {
      const lo = new Date(Math.max(l.startDate.getTime(), period.startDate.getTime()));
      const hi = new Date(Math.min(l.endDate.getTime(), period.endDate.getTime()));
      const days = l.halfDay ? 0.5 : Math.round((hi.getTime() - lo.getTime()) / 86400000) + 1;
      unpaidMap.set(l.employeeId, (unpaidMap.get(l.employeeId) ?? 0) + days);
    }

    const inputs: EmployeePeriodInputs[] = employees.map((e) => {
      const marks = marksByEmp.get(e.id) ?? [];
      const t = summarize(marks);
      const adj = adjMap.get(e.id);
      const unpaidDays = unpaidMap.get(e.id) ?? 0;
      const unpaidDeduction = round2(unpaidDays * Number(e.dailyRateUsd));
      return {
        employeeId: e.id,
        nameEn: e.nameEn, nameKh: e.nameKh, nameZh: e.nameZh,
        dailyRateUsd: Number(e.dailyRateUsd),
        daysWorked: t.present,
        overtimeUsd: otByEmp.get(e.id) ?? 0,
        bonusUsd: adj?.bonus ?? 0,
        deductionUsd: round2((adj?.deduction ?? 0) + unpaidDeduction),
      };
    });

    const result = runPayroll(inputs, exchangeRate);

    // Persist as a run + snapshot payslips in one transaction.
    await prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.create({
        data: { periodId, exchangeRate, createdById: actor.id },
      });
      for (const p of result.payslips) {
        await tx.payslip.upsert({
          where: { periodId_employeeId: { periodId, employeeId: p.employeeId } },
          update: {
            runId: run.id, daysWorked: p.daysWorked, dailyRateUsd: p.dailyRateUsd,
            overtimeHours: 0, overtimeUsd: p.overtimeUsd, bonusUsd: p.bonusUsd,
            deductionUsd: p.deductionUsd, baseUsd: p.baseUsd, grossUsd: p.grossUsd,
            netUsd: p.netUsd, exchangeRate, netKhr: p.netKhr, breakdown: p.breakdown,
            finalized: false,
          },
          create: {
            periodId, runId: run.id, employeeId: p.employeeId,
            daysWorked: p.daysWorked, dailyRateUsd: p.dailyRateUsd,
            overtimeHours: 0, overtimeUsd: p.overtimeUsd, bonusUsd: p.bonusUsd,
            deductionUsd: p.deductionUsd, baseUsd: p.baseUsd, grossUsd: p.grossUsd,
            netUsd: p.netUsd, exchangeRate, netKhr: p.netKhr, breakdown: p.breakdown,
          },
        });
      }
    });

    await writeAudit({
      userId: actor.id, action: "payroll.run", entityType: "PayPeriod", entityId: periodId,
      after: { headcount: result.totals.headcount, grossUsd: result.totals.grossUsd },
    });

    return { ok: true, data: { count: result.payslips.length, grossUsd: result.totals.grossUsd } };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/** Lock a period — payslips become immutable (Owner only). */
export async function lockPeriod(periodId: number): Promise<ActionResult> {
  try {
    const actor = await guard("payroll.lock");
    const before = await prisma.payPeriod.findUnique({ where: { id: periodId } });
    if (!before) return { ok: false, error: "Period not found" };
    const after = await prisma.$transaction(async (tx) => {
      await tx.payslip.updateMany({ where: { periodId }, data: { finalized: true } });
      return tx.payPeriod.update({ where: { id: periodId }, data: { locked: true } });
    });
    await writeAudit({ userId: actor.id, action: "payroll.lock", entityType: "PayPeriod", entityId: periodId, before, after });
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function getPayslips(periodId: number) {
  await guard("payroll.read");
  return prisma.payslip.findMany({
    where: { periodId },
    include: { employee: { select: { nameEn: true, nameKh: true, nameZh: true } } },
    orderBy: { employeeId: "asc" },
  });
}

/** CSV export (Owner/HR/Viewer). Returns the file body as a string. */
export async function exportPayrollCsv(periodId: number): Promise<ActionResult<{ filename: string; csv: string }>> {
  try {
    await guard("report.export");
    const slips = await prisma.payslip.findMany({
      where: { periodId },
      include: { employee: { select: { nameEn: true, nameKh: true, nameZh: true } } },
      orderBy: { employeeId: "asc" },
    });
    const period = await prisma.payPeriod.findUnique({ where: { id: periodId } });
    // Re-shape DB rows into the run result shape the CSV writer expects.
    const run = {
      payslips: slips.map((s) => ({
        employeeId: s.employeeId, nameEn: s.employee.nameEn, nameKh: s.employee.nameKh, nameZh: s.employee.nameZh,
        dailyRateUsd: Number(s.dailyRateUsd), daysWorked: Number(s.daysWorked),
        baseUsd: Number(s.baseUsd), overtimeUsd: Number(s.overtimeUsd), bonusUsd: Number(s.bonusUsd),
        deductionUsd: Number(s.deductionUsd), grossUsd: Number(s.grossUsd), netUsd: Number(s.netUsd), netKhr: Number(s.netKhr),
      })),
      totals: {
        headcount: slips.length,
        daysWorked: round2(slips.reduce((a, s) => a + Number(s.daysWorked), 0)),
        baseUsd: round2(slips.reduce((a, s) => a + Number(s.baseUsd), 0)),
        overtimeUsd: round2(slips.reduce((a, s) => a + Number(s.overtimeUsd), 0)),
        bonusUsd: round2(slips.reduce((a, s) => a + Number(s.bonusUsd), 0)),
        deductionUsd: round2(slips.reduce((a, s) => a + Number(s.deductionUsd), 0)),
        grossUsd: round2(slips.reduce((a, s) => a + Number(s.grossUsd), 0)),
        netUsd: round2(slips.reduce((a, s) => a + Number(s.netUsd), 0)),
        netKhr: slips.reduce((a, s) => a + Number(s.netKhr), 0),
      },
    };
    const csv = payrollToCsv(run as Parameters<typeof payrollToCsv>[0]);
    const tag = period ? `${period.year}-${String(period.month).padStart(2, "0")}-H${period.half}` : `period-${periodId}`;
    return { ok: true, data: { filename: `payroll-${tag}.csv`, csv } };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;
function errMsg(e: unknown): string {
  if (e instanceof Error) {
    if (e.message === "Not authenticated") redirect("/login");
    return e.name === "ForbiddenError" ? "You do not have permission for this action." : e.message;
  }
  return "Unexpected error";
}
