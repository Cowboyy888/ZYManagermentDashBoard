import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { nowICT, todayICT, startOfTodayICT } from "../date";

// ICT is UTC+7 = 7 * 3600 * 1000 ms
const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;

describe("nowICT", () => {
  it("is approximately 7 hours ahead of UTC now", () => {
    const before = Date.now() + ICT_OFFSET_MS;
    const ict = nowICT();
    const after = Date.now() + ICT_OFFSET_MS;
    expect(ict.getTime()).toBeGreaterThanOrEqual(before);
    expect(ict.getTime()).toBeLessThanOrEqual(after + 5);
  });
});

describe("todayICT", () => {
  afterEach(() => vi.useRealTimers());

  it("returns YYYY-MM-DD format", () => {
    expect(todayICT()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns Cambodia date, not UTC date, when UTC time is before 07:00", () => {
    // Simulate server UTC time = 2026-01-15 01:30:00 UTC
    // Cambodia time = 2026-01-15 08:30:00 ICT → same date as UTC in this case
    const utcMidnightPlus90 = new Date("2026-01-15T01:30:00.000Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(utcMidnightPlus90);
    // 01:30 UTC → 08:30 ICT → still January 15
    expect(todayICT()).toBe("2026-01-15");
  });

  it("returns next day in Cambodia when UTC is 20:00 (already next day in ICT)", () => {
    // 2026-01-15 20:00 UTC → 2026-01-16 03:00 ICT
    const utc2000 = new Date("2026-01-15T20:00:00.000Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(utc2000);
    expect(todayICT()).toBe("2026-01-16");
  });

  it("returns same date as UTC when UTC is 07:00 exactly (ICT midnight edge)", () => {
    // 2026-06-30 07:00:00 UTC → 2026-06-30 14:00:00 ICT
    const utc0700 = new Date("2026-06-30T07:00:00.000Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(utc0700);
    expect(todayICT()).toBe("2026-06-30");
  });

  it("differs from UTC date when UTC is 17:00+ (ICT is already next day)", () => {
    // 2026-07-08 17:00 UTC → 2026-07-09 00:00 ICT (midnight in Cambodia)
    const utc1700 = new Date("2026-07-08T17:00:00.000Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(utc1700);
    // UTC date is 2026-07-08, ICT date is 2026-07-09
    const utcDate = new Date(utc1700).toISOString().slice(0, 10);
    const ictDate = todayICT();
    expect(utcDate).toBe("2026-07-08");
    expect(ictDate).toBe("2026-07-09");
  });
});

describe("startOfTodayICT", () => {
  afterEach(() => vi.useRealTimers());

  it("returns a Date at midnight UTC of the ICT calendar date", () => {
    // 2026-07-08 20:00 UTC → ICT date = 2026-07-09
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T20:00:00.000Z").getTime());
    const start = startOfTodayICT();
    expect(start.toISOString()).toBe("2026-07-09T00:00:00.000Z");
  });
});
