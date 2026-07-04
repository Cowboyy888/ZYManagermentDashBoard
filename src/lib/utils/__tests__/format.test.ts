import { describe, it, expect } from "vitest";
import {
  fmtUsd, fmtNumber, fmtPercent, fmtWeight,
  fmtDate, fmtDuration, fmtEmployeeName, fmtInitials, fmtFileSize, fmtStatus,
  fmtRelative,
} from "../format";

// ─── Currency ────────────────────────────────────────────────────────────────

describe("fmtUsd", () => {
  it("formats whole dollars", () => {
    expect(fmtUsd(1000)).toBe("$1,000.00");
  });
  it("formats cents", () => {
    expect(fmtUsd(12.5)).toBe("$12.50");
  });
  it("handles null/undefined as zero", () => {
    expect(fmtUsd(null)).toBe("$0.00");
    expect(fmtUsd(undefined)).toBe("$0.00");
  });
  it("compact K suffix", () => {
    expect(fmtUsd(5000, { compact: true })).toBe("$5.0K");
  });
  it("compact M suffix", () => {
    expect(fmtUsd(2_500_000, { compact: true })).toBe("$2.5M");
  });
});

// ─── Numbers ─────────────────────────────────────────────────────────────────

describe("fmtNumber", () => {
  it("formats integers", () => {
    expect(fmtNumber(1234)).toBe("1,234");
  });
  it("formats decimals with given precision", () => {
    expect(fmtNumber(3.14159, 2)).toBe("3.14");
  });
  it("handles null/undefined as zero", () => {
    expect(fmtNumber(null)).toBe("0");
    expect(fmtNumber(undefined)).toBe("0");
  });
});

// ─── Percent ─────────────────────────────────────────────────────────────────

describe("fmtPercent", () => {
  it("formats a percentage with one decimal", () => {
    expect(fmtPercent(87.5)).toBe("87.5%");
  });
  it("respects custom decimal count", () => {
    expect(fmtPercent(99.999, 0)).toBe("100%");
  });
  it("returns dash for null", () => {
    expect(fmtPercent(null)).toBe("—");
  });
  it("returns dash for undefined", () => {
    expect(fmtPercent(undefined)).toBe("—");
  });
});

// ─── Weight ──────────────────────────────────────────────────────────────────

describe("fmtWeight", () => {
  it("shows kg below 1000", () => {
    expect(fmtWeight(750)).toBe("750.00 kg");
  });
  it("converts to tonnes at 1000+", () => {
    expect(fmtWeight(2500)).toBe("2.50 t");
  });
  it("handles null as zero", () => {
    expect(fmtWeight(null)).toBe("0.00 kg");
  });
});

// ─── Dates ───────────────────────────────────────────────────────────────────

describe("fmtDate", () => {
  const ISO = "2024-06-15T00:00:00.000Z";

  it("returns dash for null", () => {
    expect(fmtDate(null)).toBe("—");
  });
  it("returns dash for undefined", () => {
    expect(fmtDate(undefined)).toBe("—");
  });
  it("returns dash for invalid date string", () => {
    expect(fmtDate("not-a-date")).toBe("—");
  });
  it("medium format contains month abbreviation", () => {
    const result = fmtDate(ISO, "medium");
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/2024/);
  });
  it("short format uses numeric month", () => {
    const result = fmtDate(ISO, "short");
    expect(result).toMatch(/\d{2}\/\d{2}\/2024/);
  });
  it("long format contains full month name", () => {
    const result = fmtDate(ISO, "long");
    expect(result).toMatch(/June/);
  });
  it("accepts a Date object", () => {
    const d = new Date("2024-01-01T12:00:00Z");
    expect(fmtDate(d)).toMatch(/2024/);
  });
});

// ─── Duration ────────────────────────────────────────────────────────────────

describe("fmtDuration", () => {
  it("shows minutes only below 60", () => {
    expect(fmtDuration(45)).toBe("45m");
  });
  it("shows hours without remainder", () => {
    expect(fmtDuration(120)).toBe("2h");
  });
  it("shows hours and minutes", () => {
    expect(fmtDuration(90)).toBe("1h 30m");
  });
  it("handles 0 minutes", () => {
    expect(fmtDuration(0)).toBe("0m");
  });
});

// ─── Names ───────────────────────────────────────────────────────────────────

describe("fmtEmployeeName", () => {
  it("returns English name by default", () => {
    expect(fmtEmployeeName("John Doe", "ចន ដូ")).toBe("John Doe");
  });
  it("prefers Khmer when preferKh is set", () => {
    expect(fmtEmployeeName("John Doe", "ចន ដូ", { preferKh: true })).toBe("ចន ដូ");
  });
  it("falls back to English when Khmer is absent and preferKh is set", () => {
    expect(fmtEmployeeName("John Doe", null, { preferKh: true })).toBe("John Doe");
  });
  it("shows both names when showBoth is set", () => {
    expect(fmtEmployeeName("John Doe", "ចន ដូ", { showBoth: true })).toBe("John Doe (ចន ដូ)");
  });
});

describe("fmtInitials", () => {
  it("extracts two initials", () => {
    expect(fmtInitials("John Doe")).toBe("JD");
  });
  it("handles single name", () => {
    expect(fmtInitials("Alice")).toBe("A");
  });
  it("uses only first two words", () => {
    expect(fmtInitials("Anne Marie Louise")).toBe("AM");
  });
  it("uppercases", () => {
    expect(fmtInitials("john doe")).toBe("JD");
  });
});

// ─── File sizes ──────────────────────────────────────────────────────────────

describe("fmtFileSize", () => {
  it("shows bytes below 1 KB", () => {
    expect(fmtFileSize(500)).toBe("500 B");
  });
  it("shows KB", () => {
    expect(fmtFileSize(2048)).toBe("2.0 KB");
  });
  it("shows MB", () => {
    expect(fmtFileSize(5_242_880)).toBe("5.0 MB");
  });
});

// ─── Status labels ────────────────────────────────────────────────────────────

describe("fmtStatus", () => {
  it("converts underscore_case to Title Case", () => {
    expect(fmtStatus("UNDER_REVIEW")).toBe("Under Review");
  });
  it("handles single word", () => {
    expect(fmtStatus("PENDING")).toBe("Pending");
  });
  it("handles already-lowercase input", () => {
    expect(fmtStatus("in_progress")).toBe("In Progress");
  });
});

// ─── Relative time ────────────────────────────────────────────────────────────

describe("fmtRelative", () => {
  it("returns dash for null", () => {
    expect(fmtRelative(null)).toBe("—");
  });
  it("returns 'just now' for very recent dates", () => {
    const recent = new Date(Date.now() - 10_000);
    expect(fmtRelative(recent)).toBe("just now");
  });
  it("returns minutes ago", () => {
    const d = new Date(Date.now() - 5 * 60 * 1000);
    expect(fmtRelative(d)).toBe("5m ago");
  });
  it("returns hours ago", () => {
    const d = new Date(Date.now() - 3 * 3600 * 1000);
    expect(fmtRelative(d)).toBe("3h ago");
  });
  it("returns days ago", () => {
    const d = new Date(Date.now() - 2 * 86400 * 1000);
    expect(fmtRelative(d)).toBe("2d ago");
  });
});
