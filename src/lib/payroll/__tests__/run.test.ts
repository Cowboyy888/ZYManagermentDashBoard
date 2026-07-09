import { describe, it, expect } from "vitest";
import { runPayroll, type EmployeePeriodInputs } from "../run";
import { round2 } from "../calc";

const emp = (overrides: Partial<EmployeePeriodInputs> = {}): EmployeePeriodInputs => ({
  employeeId: 1,
  nameEn: "Test Employee",
  nameKh: "បុគ្គលិកសាកល្បង",
  dailyRateUsd: 10,
  daysWorked: 20,
  overtimeUsd: 0,
  ...overrides,
});

// ── runPayroll: basic ─────────────────────────────────────────────────────────

describe("runPayroll — single employee", () => {
  it("returns one payslip with correct values", () => {
    const result = runPayroll([emp()]);
    expect(result.payslips).toHaveLength(1);
    expect(result.payslips[0].baseUsd).toBe(200);
    expect(result.payslips[0].netUsd).toBe(200);
    expect(result.payslips[0].employeeId).toBe(1);
  });

  it("breakdown matches computed values", () => {
    const e = emp({ dailyRateUsd: 12, daysWorked: 15, overtimeUsd: 30, bonusUsd: 10, deductionUsd: 5 });
    const { payslips } = runPayroll([e], 4100);
    const p = payslips[0];
    expect(p.breakdown.base.subtotal).toBe(p.baseUsd);
    expect(p.breakdown.overtime.amountUsd).toBe(p.overtimeUsd);
    expect(p.breakdown.bonus.amountUsd).toBe(p.bonusUsd);
    expect(p.breakdown.deduction.amountUsd).toBe(p.deductionUsd);
    expect(p.breakdown.exchangeRate).toBe(4100);
  });
});

// ── runPayroll: multi-employee ─────────────────────────────────────────────────

describe("runPayroll — multiple employees", () => {
  const inputs: EmployeePeriodInputs[] = [
    emp({ employeeId: 1, dailyRateUsd: 10, daysWorked: 26, overtimeUsd: 5 }),
    emp({ employeeId: 2, dailyRateUsd: 8,  daysWorked: 24, overtimeUsd: 0, bonusUsd: 20 }),
    emp({ employeeId: 3, dailyRateUsd: 15, daysWorked: 20, overtimeUsd: 10, deductionUsd: 30 }),
  ];

  it("payslip count equals input count", () => {
    expect(runPayroll(inputs).payslips).toHaveLength(3);
  });

  it("totals.headcount = number of employees", () => {
    expect(runPayroll(inputs).totals.headcount).toBe(3);
  });

  it("totals.baseUsd = sum of individual payslip baseUsd values", () => {
    const result = runPayroll(inputs);
    const expected = round2(result.payslips.reduce((a, p) => a + p.baseUsd, 0));
    expect(result.totals.baseUsd).toBeCloseTo(expected, 2);
  });

  it("totals.netUsd = sum of individual netUsd values", () => {
    const result = runPayroll(inputs);
    const expected = round2(result.payslips.reduce((a, p) => a + p.netUsd, 0));
    expect(result.totals.netUsd).toBeCloseTo(expected, 2);
  });

  it("totals.grossUsd = sum of individual grossUsd values", () => {
    const result = runPayroll(inputs);
    const expected = round2(result.payslips.reduce((a, p) => a + p.grossUsd, 0));
    expect(result.totals.grossUsd).toBeCloseTo(expected, 2);
  });

  it("totals.netKhr = sum of individual netKhr values", () => {
    const result = runPayroll(inputs, 4100);
    const expected = result.payslips.reduce((a, p) => a + p.netKhr, 0);
    expect(result.totals.netKhr).toBe(expected);
  });
});

// ── runPayroll: KHR conversion ────────────────────────────────────────────────

describe("runPayroll — KHR conversion", () => {
  it("uses provided exchangeRate for KHR conversion", () => {
    const result = runPayroll([emp({ dailyRateUsd: 10, daysWorked: 10 })], 4200);
    expect(result.payslips[0].netKhr).toBe(100 * 4200);
    expect(result.payslips[0].breakdown.exchangeRate).toBe(4200);
  });

  it("defaults to 4100 KHR/USD when exchangeRate is omitted", () => {
    const result = runPayroll([emp({ dailyRateUsd: 1, daysWorked: 1 })]);
    expect(result.payslips[0].netKhr).toBe(4100);
  });
});

// ── runPayroll: zero daysWorked ───────────────────────────────────────────────

describe("runPayroll — zero daysWorked", () => {
  it("employee with 0 daysWorked has baseUsd = 0 and netUsd = 0 (no deduction)", () => {
    const result = runPayroll([emp({ daysWorked: 0, overtimeUsd: 0 })]);
    const p = result.payslips[0];
    expect(p.baseUsd).toBe(0);
    expect(p.netUsd).toBe(0);
  });

  it("employee with 0 daysWorked and a deduction has negative netUsd", () => {
    const result = runPayroll([emp({ daysWorked: 0, overtimeUsd: 0, deductionUsd: 10 })]);
    expect(result.payslips[0].netUsd).toBe(-10);
  });
});

// ── runPayroll: empty input ────────────────────────────────────────────────────

describe("runPayroll — empty input", () => {
  it("returns empty payslips and zero totals", () => {
    const result = runPayroll([]);
    expect(result.payslips).toHaveLength(0);
    expect(result.totals.headcount).toBe(0);
    expect(result.totals.netUsd).toBe(0);
    expect(result.totals.netKhr).toBe(0);
  });
});
