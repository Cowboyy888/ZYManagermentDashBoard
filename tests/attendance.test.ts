import { describe, it, expect } from "vitest";
import { dayWorked, summarize, parseMark } from "../src/lib/payroll/attendance";

describe("dayWorked", () => {
  it("full present day = 1.0", () => {
    expect(dayWorked({ am: "PRESENT", pm: "PRESENT" })).toBe(1.0);
  });
  it("half present (AM worked, PM leave) = 0.5", () => {
    expect(dayWorked({ am: "PRESENT", pm: "LEAVE" })).toBe(0.5);
  });
  it("absent both halves = 0", () => {
    expect(dayWorked({ am: "ABSENT", pm: "ABSENT" })).toBe(0);
  });
});

describe("summarize", () => {
  it("reproduces Chea Chean's TRUE marks (55√ 5△ over 30 days)", () => {
    // The source sheet's summary column miscounts leave as 3.5; the actual
    // daily marks give 2.5. This test pins the CORRECT value.
    const days = [
      ...Array(27).fill({ am: "PRESENT", pm: "PRESENT" }),  // 54 √
      { am: "PRESENT", pm: "PRESENT" },                      // +2 √ = 56? adjust
    ];
    // Build exactly 55 present-halves + 5 leave-halves = 30 days
    const marks: { am: any; pm: any }[] = [];
    let present = 0, leave = 0;
    for (let i = 0; i < 30; i++) marks.push({ am: "PRESENT", pm: "PRESENT" });
    // convert 5 half-slots to LEAVE
    marks[5].am = "LEAVE"; marks[13].am = "LEAVE"; marks[21].am = "LEAVE";
    marks[5].pm = "LEAVE"; marks[13].pm = "LEAVE";
    const t = summarize(marks);
    expect(t.present).toBe(27.5);
    expect(t.leave).toBe(2.5);
    expect(t.absent).toBe(0);
  });
  it("present + leave + absent always equals day count", () => {
    const days = Array(15).fill({ am: "PRESENT", pm: "PRESENT" });
    const t = summarize(days);
    expect(t.present + t.leave + t.absent).toBe(15);
  });
});

describe("parseMark", () => {
  it("parses Khmer-sheet glyphs", () => {
    expect(parseMark("√")).toBe("PRESENT");
    expect(parseMark("△")).toBe("LEAVE");
    expect(parseMark("×")).toBe("ABSENT");
  });
  it("rejects unknown glyphs (catches import corruption)", () => {
    expect(() => parseMark("?")).toThrow();
  });
});
