// ZYSTEEL HR — payroll run engine (Stage 3).
// Pure assembly: given a period's attendance + OT + employee rates, produce the
// payslip line-items. No I/O — the Server Action loads data, calls this, persists
// the immutable snapshot (arch §3.1).

import { computePayslip, type PaySlip } from "./calc";

export interface EmployeePeriodInputs {
  employeeId: number;
  nameEn: string;
  nameKh: string;
  nameZh?: string | null;
  dailyRateUsd: number;
  daysWorked: number;     // resolved from attendance (PRESENT halves)
  overtimeUsd: number;    // summed OT incident amounts in the period window
  bonusUsd?: number;
  deductionUsd?: number;
}

export interface PayslipResult extends PaySlip {
  employeeId: number;
  nameEn: string;
  nameKh: string;
  nameZh?: string | null;
  dailyRateUsd: number;
  daysWorked: number;
  // Reproducible breakdown for audit + reprint (stored as JSON on the payslip).
  breakdown: {
    base: { dailyRateUsd: number; daysWorked: number; subtotal: number };
    overtime: { amountUsd: number };
    bonus: { amountUsd: number };
    deduction: { amountUsd: number };
    exchangeRate: number;
  };
}

export interface PayrollRunResult {
  payslips: PayslipResult[];
  totals: {
    headcount: number;
    daysWorked: number;
    baseUsd: number;
    overtimeUsd: number;
    bonusUsd: number;
    deductionUsd: number;
    grossUsd: number;
    netUsd: number;
    netKhr: number;
  };
}

const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

/** Run payroll for a set of employee inputs at a given exchange rate. */
export function runPayroll(
  inputs: EmployeePeriodInputs[],
  exchangeRate = 4100
): PayrollRunResult {
  const payslips: PayslipResult[] = inputs.map((i) => {
    const slip = computePayslip({
      dailyRateUsd: i.dailyRateUsd,
      daysWorked: i.daysWorked,
      overtimeUsd: i.overtimeUsd,
      bonusUsd: i.bonusUsd ?? 0,
      deductionUsd: i.deductionUsd ?? 0,
      exchangeRate,
    });
    return {
      ...slip,
      employeeId: i.employeeId,
      nameEn: i.nameEn,
      nameKh: i.nameKh,
      nameZh: i.nameZh ?? null,
      dailyRateUsd: i.dailyRateUsd,
      daysWorked: i.daysWorked,
      breakdown: {
        base: { dailyRateUsd: i.dailyRateUsd, daysWorked: i.daysWorked, subtotal: slip.baseUsd },
        overtime: { amountUsd: slip.overtimeUsd },
        bonus: { amountUsd: slip.bonusUsd },
        deduction: { amountUsd: slip.deductionUsd },
        exchangeRate,
      },
    };
  });

  return {
    payslips,
    totals: {
      headcount: payslips.length,
      daysWorked: sum(payslips.map((p) => p.daysWorked)),
      baseUsd: sum(payslips.map((p) => p.baseUsd)),
      overtimeUsd: sum(payslips.map((p) => p.overtimeUsd)),
      bonusUsd: sum(payslips.map((p) => p.bonusUsd)),
      deductionUsd: sum(payslips.map((p) => p.deductionUsd)),
      grossUsd: sum(payslips.map((p) => p.grossUsd)),
      netUsd: sum(payslips.map((p) => p.netUsd)),
      netKhr: payslips.reduce((a, p) => a + p.netKhr, 0),
    },
  };
}

/** CSV export of a run — used by the Reports module. */
export function payrollToCsv(run: PayrollRunResult): string {
  const head = [
    "Employee ID", "Name (EN)", "Name (KH)", "Daily Rate USD", "Days Worked",
    "Base USD", "Overtime USD", "Bonus USD", "Deduction USD", "Gross USD", "Net USD", "Net KHR",
  ];
  const rows = run.payslips.map((p) => [
    p.employeeId, q(p.nameEn), q(p.nameKh), p.dailyRateUsd.toFixed(2), p.daysWorked,
    p.baseUsd.toFixed(2), p.overtimeUsd.toFixed(2), p.bonusUsd.toFixed(2),
    p.deductionUsd.toFixed(2), p.grossUsd.toFixed(2), p.netUsd.toFixed(2), p.netKhr,
  ].join(","));
  const totals = run.totals;
  const totalRow = [
    "", "TOTAL", "", "", totals.daysWorked,
    totals.baseUsd.toFixed(2), totals.overtimeUsd.toFixed(2), totals.bonusUsd.toFixed(2),
    totals.deductionUsd.toFixed(2), totals.grossUsd.toFixed(2), totals.netUsd.toFixed(2), totals.netKhr,
  ].join(",");
  return [head.join(","), ...rows, totalRow].join("\n");
}

// CSV-escape a field that may contain commas/quotes/unicode.
function q(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
