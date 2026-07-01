import { describe, it, expect } from "vitest";
import { can, authorize, ForbiddenError } from "../src/lib/rbac";

describe("RBAC base matrix", () => {
  it("OWNER can do everything sampled", () => {
    expect(can("OWNER", "payroll.lock")).toBe(true);
    expect(can("OWNER", "user.manage")).toBe(true);
    expect(can("OWNER", "employee.delete")).toBe(true);
    expect(can("OWNER", "settings.write")).toBe(true);
  });
  it("VIEWER is read-only", () => {
    expect(can("VIEWER", "employee.read")).toBe(true);
    expect(can("VIEWER", "report.export")).toBe(true);
    expect(can("VIEWER", "employee.create")).toBe(false);
    expect(can("VIEWER", "attendance.write")).toBe(false);
    expect(can("VIEWER", "payroll.run")).toBe(false);
  });
  it("HR_MANAGER runs payroll but cannot lock or manage users", () => {
    expect(can("HR_MANAGER", "payroll.run")).toBe(true);
    expect(can("HR_MANAGER", "payroll.lock")).toBe(false);
    expect(can("HR_MANAGER", "user.manage")).toBe(false);
  });
  it("only OWNER deletes employees or locks payroll", () => {
    expect(can("HR_MANAGER", "employee.delete")).toBe(false);
    expect(can("SUPERVISOR", "employee.delete")).toBe(false);
  });
});

describe("RBAC department scoping for SUPERVISOR", () => {
  it("can write attendance for own department", () => {
    expect(can("SUPERVISOR", "attendance.write", { actorDeptId: 1, targetDeptId: 1 })).toBe(true);
  });
  it("cannot write attendance for another department", () => {
    expect(can("SUPERVISOR", "attendance.write", { actorDeptId: 1, targetDeptId: 2 })).toBe(false);
  });
  it("cannot write attendance with no department assigned", () => {
    expect(can("SUPERVISOR", "attendance.write", { actorDeptId: null, targetDeptId: 1 })).toBe(false);
  });
  it("OWNER/HR are not department-constrained", () => {
    expect(can("OWNER", "attendance.write", { actorDeptId: 1, targetDeptId: 2 })).toBe(true);
    expect(can("HR_MANAGER", "overtime.create", { actorDeptId: 1, targetDeptId: 2 })).toBe(true);
  });
  it("supervisor cannot approve overtime (only create)", () => {
    expect(can("SUPERVISOR", "overtime.create", { actorDeptId: 1, targetDeptId: 1 })).toBe(true);
    expect(can("SUPERVISOR", "overtime.approve")).toBe(false);
  });
});

describe("authorize() throwing variant", () => {
  it("throws ForbiddenError when denied", () => {
    expect(() => authorize("VIEWER", "payroll.run")).toThrow(ForbiddenError);
  });
  it("returns silently when allowed", () => {
    expect(() => authorize("OWNER", "payroll.run")).not.toThrow();
  });
});
