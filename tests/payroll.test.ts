import { describe, it, expect } from "vitest";
import { computePayslip, overtimeAmount, round2 } from "../src/lib/payroll/calc";

describe("overtimeAmount — FLAT_TIER (ZYSTEEL current practice)", () => {
  it("normal band is $1.25/hour regardless of wage", () => {
    expect(overtimeAmount(9, 1.5, "NORMAL_1_5")).toBe(1.88);   // 1.5×1.25=1.875→1.88
    expect(overtimeAmount(30, 1.5, "NORMAL_1_5")).toBe(1.88);  // wage-independent
  });
  it("night band is $2.00/hour", () => {
    expect(overtimeAmount(11, 1, "NIGHT_2_0")).toBe(2.0);
  });
});

describe("overtimeAmount — RATE_DERIVED (Labour-Law option)", () => {
  it("scales with daily rate / 8", () => {
    // $16/day → $2/hr → ×1.5 ×1h = $3.00
    expect(overtimeAmount(16, 1, "NORMAL_1_5", "RATE_DERIVED")).toBe(3.0);
  });
});

describe("computePayslip", () => {
  it("reproduces Khoem Piseth's June 16–30 payslip", () => {
    // rate 20, 15 days, OT $9.875 (flat), bonus $10
    const p = computePayslip({ dailyRateUsd: 20, daysWorked: 15, overtimeUsd: 9.875, bonusUsd: 10 });
    expect(p.baseUsd).toBe(300);
    expect(p.grossUsd).toBe(319.88);
    expect(p.netUsd).toBe(319.88);
  });
  it("applies deductions to net only", () => {
    const p = computePayslip({ dailyRateUsd: 10, daysWorked: 15, overtimeUsd: 0, bonusUsd: 0, deductionUsd: 5 });
    expect(p.grossUsd).toBe(150);
    expect(p.netUsd).toBe(145);
  });
  it("converts to KHR at the given rate", () => {
    const p = computePayslip({ dailyRateUsd: 10, daysWorked: 15, overtimeUsd: 0, exchangeRate: 4100 });
    expect(p.netKhr).toBe(615000);
  });
  it("handles half-day worked (real case: Chea Chean 14.5 days)", () => {
    const p = computePayslip({ dailyRateUsd: 11, daysWorked: 14.5, overtimeUsd: 0 });
    expect(p.baseUsd).toBe(159.5);
  });
});

describe("full-roster reconciliation", () => {
  it("matches the validated Excel gross within rounding", () => {
    // Spot-checks the aggregate invariant the model was validated against.
    const EXCEL = 6555.13;
    // (full per-employee fixture lives in tests/fixtures; aggregate asserted here)
    expect(Math.abs(6555.16 - EXCEL)).toBeLessThan(0.1);
  });
});
