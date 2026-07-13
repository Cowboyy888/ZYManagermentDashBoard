import { describe, it, expect } from "vitest";
import {
  round2,
  overtimeAmount,
  computePayslip,
  BAND_FLAT_USD,
  BAND_MULTIPLIER,
  hourlyRate,
} from "../calc";

// ── round2 ────────────────────────────────────────────────────────────────────

describe("round2", () => {
  it("rounds to 2 decimal places", () => {
    expect(round2(1.234)).toBe(1.23);
    expect(round2(1.235)).toBe(1.24);
    expect(round2(1.236)).toBe(1.24);
  });

  it("handles zero", () => {
    expect(round2(0)).toBe(0);
  });

  it("boundary: 1.005 rounds to 1.01 — Number.EPSILON nudge corrects binary float error", () => {
    expect(round2(1.005)).toBe(1.01);
  });

  it("boundary: 1.125 rounds to 1.13", () => {
    expect(round2(1.125)).toBe(1.13);
  });

  it("negative values", () => {
    expect(round2(-1.235)).toBe(-1.24);
  });
});

// ── overtimeAmount — FLAT_TIER ────────────────────────────────────────────────

describe("overtimeAmount — FLAT_TIER", () => {
  it("NORMAL_1_5: 2h × $1.25 = $2.50", () => {
    expect(overtimeAmount(10, 2, "NORMAL_1_5", "FLAT_TIER")).toBe(2.5);
  });

  it("NIGHT_2_0: 3h × $2.00 = $6.00", () => {
    expect(overtimeAmount(10, 3, "NIGHT_2_0", "FLAT_TIER")).toBe(6.0);
  });

  it("HOLIDAY_2_0: 1.5h × $2.00 = $3.00", () => {
    expect(overtimeAmount(10, 1.5, "HOLIDAY_2_0", "FLAT_TIER")).toBe(3.0);
  });

  it("uses FLAT_TIER by default when mode is omitted", () => {
    expect(overtimeAmount(10, 2, "NORMAL_1_5")).toBe(round2(2 * BAND_FLAT_USD["NORMAL_1_5"]));
  });

  it("result is independent of dailyRateUsd in FLAT_TIER mode", () => {
    expect(overtimeAmount(5, 2, "NORMAL_1_5", "FLAT_TIER")).toBe(
      overtimeAmount(50, 2, "NORMAL_1_5", "FLAT_TIER")
    );
  });
});

// ── overtimeAmount — RATE_DERIVED ─────────────────────────────────────────────

describe("overtimeAmount — RATE_DERIVED", () => {
  it("NORMAL_1_5: $8/day rate, 2h → ($8/8) × 2 × 1.5 = $3.00", () => {
    expect(overtimeAmount(8, 2, "NORMAL_1_5", "RATE_DERIVED")).toBe(3.0);
  });

  it("NIGHT_2_0: $8/day rate, 1h → ($8/8) × 1 × 2.0 = $2.00", () => {
    expect(overtimeAmount(8, 1, "NIGHT_2_0", "RATE_DERIVED")).toBe(2.0);
  });

  it("HOLIDAY_2_0: $12/day rate, 3h → ($12/8) × 3 × 2.0 = $9.00", () => {
    expect(overtimeAmount(12, 3, "HOLIDAY_2_0", "RATE_DERIVED")).toBe(9.0);
  });

  it("result scales with dailyRateUsd in RATE_DERIVED mode", () => {
    const low = overtimeAmount(8, 2, "NORMAL_1_5", "RATE_DERIVED");
    const high = overtimeAmount(16, 2, "NORMAL_1_5", "RATE_DERIVED");
    expect(high).toBe(round2(low * 2));
  });

  it("matches formula: hourlyRate × hours × multiplier", () => {
    const dailyRate = 10;
    const hours = 4;
    const band = "NIGHT_2_0";
    const expected = round2(hourlyRate(dailyRate) * hours * BAND_MULTIPLIER[band]);
    expect(overtimeAmount(dailyRate, hours, band, "RATE_DERIVED")).toBe(expected);
  });
});

// ── computePayslip ────────────────────────────────────────────────────────────

describe("computePayslip", () => {
  it("basic case: baseUsd = dailyRate × daysWorked", () => {
    const slip = computePayslip({ dailyRateUsd: 10, daysWorked: 26, overtimeUsd: 0 });
    expect(slip.baseUsd).toBe(260);
    expect(slip.overtimeUsd).toBe(0);
    expect(slip.bonusUsd).toBe(0);
    expect(slip.deductionUsd).toBe(0);
    expect(slip.grossUsd).toBe(260);
    expect(slip.netUsd).toBe(260);
  });

  it("zero OT: gross = base + bonus, net = gross - deduction", () => {
    const slip = computePayslip({ dailyRateUsd: 10, daysWorked: 20, overtimeUsd: 0, bonusUsd: 50, deductionUsd: 10 });
    expect(slip.grossUsd).toBe(250);
    expect(slip.netUsd).toBe(240);
  });

  it("max deduction can make netUsd negative", () => {
    const slip = computePayslip({ dailyRateUsd: 5, daysWorked: 1, overtimeUsd: 0, deductionUsd: 100 });
    expect(slip.netUsd).toBe(-95);
  });

  it("zero daysWorked: baseUsd = 0, netUsd = 0 when no deduction", () => {
    const slip = computePayslip({ dailyRateUsd: 10, daysWorked: 0, overtimeUsd: 0 });
    expect(slip.baseUsd).toBe(0);
    expect(slip.netUsd).toBe(0);
  });

  it("non-default exchange rate converts netUsd to KHR correctly", () => {
    const slip = computePayslip({ dailyRateUsd: 10, daysWorked: 10, overtimeUsd: 0, exchangeRate: 4200 });
    expect(slip.netUsd).toBe(100);
    expect(slip.netKhr).toBe(420000);
  });

  it("default exchange rate is 4100", () => {
    const slip = computePayslip({ dailyRateUsd: 1, daysWorked: 1, overtimeUsd: 0 });
    expect(slip.netKhr).toBe(4100);
  });

  it("all components included in gross", () => {
    const slip = computePayslip({ dailyRateUsd: 10, daysWorked: 10, overtimeUsd: 15, bonusUsd: 20 });
    expect(slip.grossUsd).toBe(round2(100 + 15 + 20));
  });

  it("netKhr = round(netUsd × exchangeRate)", () => {
    const slip = computePayslip({ dailyRateUsd: 3.33, daysWorked: 3, overtimeUsd: 0, exchangeRate: 4100 });
    expect(slip.netKhr).toBe(Math.round(slip.netUsd * 4100));
  });
});
