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

describe("Notification RBAC", () => {
  it("all roles can read their own notifications", () => {
    expect(can("OWNER", "notification.read")).toBe(true);
    expect(can("HR_MANAGER", "notification.read")).toBe(true);
    expect(can("SUPERVISOR", "notification.read")).toBe(true);
    expect(can("VIEWER", "notification.read")).toBe(true);
  });
  it("only OWNER and HR_MANAGER can manage notifications", () => {
    expect(can("OWNER", "notification.manage")).toBe(true);
    expect(can("HR_MANAGER", "notification.manage")).toBe(true);
    expect(can("SUPERVISOR", "notification.manage")).toBe(false);
    expect(can("VIEWER", "notification.manage")).toBe(false);
  });
});

describe("Admin RBAC", () => {
  it("OWNER and HR_MANAGER can view audit log", () => {
    expect(can("OWNER", "audit.view")).toBe(true);
    expect(can("HR_MANAGER", "audit.view")).toBe(true);
    expect(can("SUPERVISOR", "audit.view")).toBe(false);
    expect(can("VIEWER", "audit.view")).toBe(false);
  });
  it("only OWNER can view system health", () => {
    expect(can("OWNER", "system.health")).toBe(true);
    expect(can("HR_MANAGER", "system.health")).toBe(false);
    expect(can("SUPERVISOR", "system.health")).toBe(false);
    expect(can("VIEWER", "system.health")).toBe(false);
  });
});

describe("BI RBAC", () => {
  it("all roles can read BI dashboards", () => {
    expect(can("OWNER", "bi.read")).toBe(true);
    expect(can("HR_MANAGER", "bi.read")).toBe(true);
    expect(can("SUPERVISOR", "bi.read")).toBe(true);
    expect(can("VIEWER", "bi.read")).toBe(true);
  });
  it("only OWNER and HR_MANAGER can manage BI", () => {
    expect(can("SUPERVISOR", "bi.manage")).toBe(false);
    expect(can("VIEWER", "bi.manage")).toBe(false);
  });
});

describe("Finance RBAC", () => {
  it("VIEWER can read finance", () => {
    expect(can("VIEWER", "finance.read")).toBe(true);
  });
  it("SUPERVISOR cannot write finance", () => {
    expect(can("SUPERVISOR", "finance.write")).toBe(false);
    expect(can("SUPERVISOR", "finance.approve")).toBe(false);
  });
  it("only OWNER can manage finance", () => {
    expect(can("HR_MANAGER", "finance.manage")).toBe(false);
    expect(can("OWNER", "finance.manage")).toBe(true);
  });
});
