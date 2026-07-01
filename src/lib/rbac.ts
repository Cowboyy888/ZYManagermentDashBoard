// ZYSTEEL HR — RBAC authority (arch §4).
// THE single source of permission truth. Every Server Action calls can() first.
// No permission decision is made anywhere else in the codebase.

export type Role = "OWNER" | "HR_MANAGER" | "SUPERVISOR" | "VIEWER";

// Actions are namespaced "domain.verb". Add here, nowhere else.
export type Action =
  | "employee.read" | "employee.create" | "employee.update" | "employee.delete"
  | "attendance.read" | "attendance.write"
  | "overtime.read" | "overtime.create" | "overtime.approve"
  | "leave.read" | "leave.request" | "leave.approve"
  | "payroll.read" | "payroll.run" | "payroll.lock"
  | "report.export"
  | "audit.read"
  | "settings.read" | "settings.write"
  | "user.manage";

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
  "audit.read":       ["OWNER", "HR_MANAGER"],

  "settings.read":    ["OWNER", "HR_MANAGER"],
  "settings.write":   ["OWNER"],

  "user.manage":      ["OWNER"],
};

// Actions where a SUPERVISOR is confined to their own department.
const DEPT_SCOPED: Set<Action> = new Set([
  "attendance.write", "overtime.create", "leave.request",
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
