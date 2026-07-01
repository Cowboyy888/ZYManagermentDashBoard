"use server";
// ZYSTEEL HR — Payroll Server Actions (Stage 3).
// Generates a run: resolve attendance → sum OT in window → snapshot payslips
// (arch §3.1, immutable once locked). Re-runnable until locked.

import { prisma } from "../lib/db";
import { guard } from "../lib/auth/session";
import { writeAudit } from "../lib/audit";
import { runPayroll, payrollToCsv, type EmployeePeriodInputs } from "../lib/payroll/run";
import { summarize, type AttendanceMark } from "../lib/payroll/attendance";
import type { ActionResult } from "./employees";

/** Generate (or regenerate) draft payslips for a period. Owner/HR only. */
export async function runPayrollForPeriod(periodId: number): Promise<ActionResult<{ count: number; grossUsd: number }>> {
  try {
    const actor = await guard("payroll.run");

    const period = await prisma.payPeriod.findUnique({ where: { id: periodId } });
    if (!period) return { ok: false, error: "Pay period not found" };
    if (period.locked) return { ok: false, error: "Period is locked. Unlock to re-run, or post an adjustment." };

    const rateSetting = await prisma.setting.findUnique({ where: { key: "exchange_rate" } });
    const exchangeRate = Number(rateSetting?.value ?? 4100);

    // Active employees + their attendance + OT within the window, in parallel.
    const [employees, attendance, overtime] = await Promise.all([
      prisma.employee.findMany({ where: { status: "ACTIVE" } }),
      prisma.attendanceDay.findMany({
        where: { date: { gte: period.startDate, lte: period.endDate } },
      }),
      prisma.overtimeEntry.findMany({
        where: { date: { gte: period.startDate, lte: period.endDate }, status: "APPROVED" },
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

    const inputs: EmployeePeriodInputs[] = employees.map((e) => {
      const marks = marksByEmp.get(e.id) ?? [];
      const t = summarize(marks);
      return {
        employeeId: e.id,
        nameEn: e.nameEn, nameKh: e.nameKh, nameZh: e.nameZh,
        dailyRateUsd: Number(e.dailyRateUsd),
        daysWorked: t.present,
        overtimeUsd: otByEmp.get(e.id) ?? 0,
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
  if (e instanceof Error) return e.name === "ForbiddenError" ? "You do not have permission for this action." : e.message;
  return "Unexpected error";
}
