import { describe, it, expect } from "vitest";
import { runPayroll, payrollToCsv } from "../src/lib/payroll/run";
import { readFileSync } from "fs";

// Load the real roster + the validated OT figures used in Stage 1.
const roster = JSON.parse(readFileSync("/tmp/payroll.json", "utf8")) as Array<{
  no: number; name: string; name_kh: string; days: number; ot: number; rate: number; bonus: number;
}>;

describe("runPayroll — full roster reconciliation", () => {
  const inputs = roster.map((e) => ({
    employeeId: e.no, nameEn: e.name, nameKh: e.name_kh,
    dailyRateUsd: e.rate, daysWorked: e.days, overtimeUsd: e.ot, bonusUsd: e.bonus,
  }));
  const run = runPayroll(inputs, 4100);

  it("reproduces the validated Excel gross total ($6,555.13 ± rounding)", () => {
    expect(Math.abs(run.totals.grossUsd - 6555.13)).toBeLessThan(0.10);
  });

  it("headcount matches the roster", () => {
    expect(run.totals.headcount).toBe(38);
  });

  it("net equals gross when there are no deductions", () => {
    expect(run.totals.netUsd).toBeCloseTo(run.totals.grossUsd, 2);
  });

  it("KHR total = net USD × 4100", () => {
    expect(run.totals.netKhr).toBe(Math.round(run.totals.netUsd * 4100));
  });

  it("each payslip carries a reproducible breakdown", () => {
    const p = run.payslips[0];
    expect(p.breakdown.base.subtotal).toBe(p.baseUsd);
    expect(p.breakdown.exchangeRate).toBe(4100);
  });
});

describe("payrollToCsv", () => {
  const run = runPayroll(
    [{ employeeId: 1, nameEn: "Test, Name", nameKh: "ខ្មែរ", dailyRateUsd: 10, daysWorked: 15, overtimeUsd: 5, bonusUsd: 0 }],
    4100
  );
  const csv = payrollToCsv(run);

  it("has a header, a data row, and a totals row", () => {
    expect(csv.split("\n")).toHaveLength(3);
  });
  it("escapes commas in names", () => {
    expect(csv).toContain('"Test, Name"');
  });
  it("preserves Khmer unicode", () => {
    expect(csv).toContain("ខ្មែរ");
  });
});
