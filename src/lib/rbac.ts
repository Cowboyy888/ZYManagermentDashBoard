// ZYSTEEL HR — RBAC authority (arch §4).
// THE single source of permission truth. Every Server Action calls can() first.
// No permission decision is made anywhere else in the codebase.

export type Role = "OWNER" | "HR_MANAGER" | "SUPERVISOR" | "VIEWER" | "CUSTOMER_PORTAL" | "SUPPLIER_PORTAL";

// Actions are namespaced "domain.verb". Add here, nowhere else.
export type Action =
  | "employee.read" | "employee.create" | "employee.update" | "employee.delete"
  | "attendance.read" | "attendance.write"
  | "overtime.read" | "overtime.create" | "overtime.approve"
  | "leave.read" | "leave.request" | "leave.approve"
  | "payroll.read" | "payroll.run" | "payroll.lock"
  | "report.export"
  | "settings.read" | "settings.write"
  | "user.manage"
  | "production.read" | "production.write" | "production.manage"
  | "maintenance.read" | "maintenance.write" | "maintenance.manage"
  | "inventory.read" | "inventory.write" | "inventory.manage"
  | "purchasing.read" | "purchasing.write" | "purchasing.approve" | "purchasing.manage"
  | "sales.read" | "sales.write" | "sales.approve" | "sales.manage"
  | "quality.read" | "quality.write" | "quality.approve" | "quality.manage"
  | "finance.read" | "finance.write" | "finance.approve" | "finance.manage"
  | "bi.read" | "bi.manage"
  | "notification.read" | "notification.manage"
  | "audit.view"
  | "system.health"
  | "portal.manage"
  | "factory.view" | "factory.manage";

// Context for scoped checks. A SUPERVISOR may only act within their own
// department; actorDeptId is theirs, targetDeptId is the record's.
export interface AccessContext {
  actorDeptId?: number | null;
  targetDeptId?: number | null;
}

// Base capability matrix: which roles may even attempt an action.
const MATRIX: Record<Action, Role[]> = {
  "employee.read":    ["OWNER", "HR_MANAGER", "SUPERVISOR", "VIEWER"],
  "employee.create":  ["OWNER", "HR_MANAGER"],
  "employee.update":  ["OWNER", "HR_MANAGER"],
  "employee.delete":  ["OWNER"],

  "attendance.read":  ["OWNER", "HR_MANAGER", "SUPERVISOR", "VIEWER"],
  "attendance.write": ["OWNER", "HR_MANAGER", "SUPERVISOR"], // SUPERVISOR scoped, see below

  "overtime.read":    ["OWNER", "HR_MANAGER", "SUPERVISOR", "VIEWER"],
  "overtime.create":  ["OWNER", "HR_MANAGER", "SUPERVISOR"], // SUPERVISOR scoped
  "overtime.approve": ["OWNER", "HR_MANAGER"],

  "leave.read":       ["OWNER", "HR_MANAGER", "SUPERVISOR", "VIEWER"],
  "leave.request":    ["OWNER", "HR_MANAGER", "SUPERVISOR"],
  "leave.approve":    ["OWNER", "HR_MANAGER"],

  "payroll.read":     ["OWNER", "HR_MANAGER", "VIEWER"],
  "payroll.run":      ["OWNER", "HR_MANAGER"],
  "payroll.lock":     ["OWNER"],

  "report.export":    ["OWNER", "HR_MANAGER", "VIEWER"],

  "settings.read":    ["OWNER", "HR_MANAGER"],
  "settings.write":   ["OWNER"],

  "user.manage":      ["OWNER"],

  "production.read":   ["OWNER", "HR_MANAGER", "SUPERVISOR", "VIEWER"],
  "production.write":  ["OWNER", "HR_MANAGER", "SUPERVISOR"],
  "production.manage": ["OWNER", "HR_MANAGER"],
  "maintenance.read":   ["OWNER", "HR_MANAGER", "SUPERVISOR", "VIEWER"],
  "maintenance.write":  ["OWNER", "HR_MANAGER", "SUPERVISOR"],
  "maintenance.manage": ["OWNER", "HR_MANAGER"],

  "inventory.read":    ["OWNER", "HR_MANAGER", "SUPERVISOR", "VIEWER"],
  "inventory.write":   ["OWNER", "HR_MANAGER", "SUPERVISOR"],
  "inventory.manage":  ["OWNER", "HR_MANAGER"],

  "purchasing.read":    ["OWNER", "HR_MANAGER", "SUPERVISOR", "VIEWER"],
  "purchasing.write":   ["OWNER", "HR_MANAGER", "SUPERVISOR"],
  "purchasing.approve": ["OWNER", "HR_MANAGER"],
  "purchasing.manage":  ["OWNER", "HR_MANAGER"],

  "sales.read":    ["OWNER", "HR_MANAGER", "SUPERVISOR", "VIEWER"],
  "sales.write":   ["OWNER", "HR_MANAGER", "SUPERVISOR"],
  "sales.approve": ["OWNER", "HR_MANAGER"],
  "sales.manage":  ["OWNER", "HR_MANAGER"],

  "quality.read":    ["OWNER", "HR_MANAGER", "SUPERVISOR", "VIEWER"],
  "quality.write":   ["OWNER", "HR_MANAGER", "SUPERVISOR"],
  "quality.approve": ["OWNER", "HR_MANAGER"],
  "quality.manage":  ["OWNER", "HR_MANAGER"],

  "finance.read":    ["OWNER", "HR_MANAGER", "VIEWER"],
  "finance.write":   ["OWNER", "HR_MANAGER"],
  "finance.approve": ["OWNER", "HR_MANAGER"],
  "finance.manage":  ["OWNER"],

  "bi.read":   ["OWNER", "HR_MANAGER", "SUPERVISOR", "VIEWER"],
  "bi.manage": ["OWNER", "HR_MANAGER"],

  "notification.read":   ["OWNER", "HR_MANAGER", "SUPERVISOR", "VIEWER"],
  "notification.manage": ["OWNER", "HR_MANAGER"],

  "audit.view":    ["OWNER", "HR_MANAGER"],
  "system.health": ["OWNER"],
  "portal.manage": ["OWNER", "HR_MANAGER"],

  "factory.view":   ["OWNER", "HR_MANAGER", "SUPERVISOR", "VIEWER"],
  "factory.manage": ["OWNER", "HR_MANAGER", "SUPERVISOR"],
};

// Actions where a SUPERVISOR is confined to their own department.
const DEPT_SCOPED: Set<Action> = new Set([
  "attendance.write", "overtime.create", "leave.request",
  "production.write", "maintenance.write", "maintenance.manage",
]);

/**
 * The authority. Returns true iff `role` may perform `action` in `ctx`.
 * Pure: no I/O, fully unit-tested. Server Actions wrap this with the live session.
 */
export function can(role: Role, action: Action, ctx: AccessContext = {}): boolean {
  const allowed = MATRIX[action];
  if (!allowed || !allowed.includes(role)) return false;

  // Department scoping only constrains SUPERVISOR on scoped actions.
  if (role === "SUPERVISOR" && DEPT_SCOPED.has(action)) {
    // Must have a department, and the target must be in it.
    if (ctx.actorDeptId == null) return false;
    if (ctx.targetDeptId != null && ctx.targetDeptId !== ctx.actorDeptId) return false;
  }
  return true;
}

/** Throwing variant for use at the top of Server Actions. */
export class ForbiddenError extends Error {
  constructor(action: Action) {
    super(`Forbidden: ${action}`);
    this.name = "ForbiddenError";
  }
}
export function authorize(role: Role, action: Action, ctx: AccessContext = {}): void {
  if (!can(role, action, ctx)) throw new ForbiddenError(action);
}
