// Pure payroll math (arch §2: no I/O, unit-testable in isolation).
// Single source of truth for how pay is computed.
//
// IMPORTANT — overtime valuation has TWO modes (discovered during validation
// against the real 加班表):
//   • FLAT_TIER   — fixed $/hour per band ($1.25 normal, $2.00 night/holiday).
//                   This is what ZYSTEEL actually pays today. DEFAULT.
//   • RATE_DERIVED— Labour-Law style: hours × (dailyRate/8) × bandMultiplier.
//                   More compliant for higher-wage staff; opt-in via Settings.
// The mode lives in the Setting table so the factory can switch without code changes.

export type OvertimeBand = "NORMAL_1_5" | "NIGHT_2_0" | "HOLIDAY_2_0";
export type OvertimeMode = "FLAT_TIER" | "RATE_DERIVED";

// RATE_DERIVED multipliers (Labour Law)
export const BAND_MULTIPLIER: Record<OvertimeBand, number> = {
  NORMAL_1_5: 1.5,
  NIGHT_2_0: 2.0,
  HOLIDAY_2_0: 2.0,
};

// FLAT_TIER rates — $/hour, the factory's current practice
export const BAND_FLAT_USD: Record<OvertimeBand, number> = {
  NORMAL_1_5: 1.25,
  NIGHT_2_0: 2.0,
  HOLIDAY_2_0: 2.0,
};

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const hourlyRate = (dailyRateUsd: number, hoursPerDay = 8) =>
  dailyRateUsd / hoursPerDay;

/** Value of one OT incident under the configured mode. */
export function overtimeAmount(
  dailyRateUsd: number,
  hours: number,
  band: OvertimeBand,
  mode: OvertimeMode = "FLAT_TIER",
  hoursPerDay = 8
): number {
  if (mode === "FLAT_TIER") {
    return round2(hours * BAND_FLAT_USD[band]);
  }
  return round2(hourlyRate(dailyRateUsd, hoursPerDay) * hours * BAND_MULTIPLIER[band]);
}

export interface PayInputs {
  dailyRateUsd: number;
  daysWorked: number;
  overtimeUsd: number;   // sum of incident amounts already valued for the period
  bonusUsd?: number;
  deductionUsd?: number;
  exchangeRate?: number; // KHR per USD
}

export interface PaySlip {
  baseUsd: number;
  overtimeUsd: number;
  bonusUsd: number;
  deductionUsd: number;
  grossUsd: number;
  netUsd: number;
  netKhr: number;
}

/** base = rate×days; gross = base+OT+bonus; net = gross−deduction. */
export function computePayslip(i: PayInputs): PaySlip {
  const bonusUsd = i.bonusUsd ?? 0;
  const deductionUsd = i.deductionUsd ?? 0;
  const exchangeRate = i.exchangeRate ?? 4100;
  const baseUsd = round2(i.dailyRateUsd * i.daysWorked);
  const overtimeUsd = round2(i.overtimeUsd);
  const grossUsd = round2(baseUsd + overtimeUsd + bonusUsd);
  const netUsd = round2(grossUsd - deductionUsd);
  return { baseUsd, overtimeUsd, bonusUsd, deductionUsd, grossUsd, netUsd, netKhr: Math.round(netUsd * exchangeRate) };
}
