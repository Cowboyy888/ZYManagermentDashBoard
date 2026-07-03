import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { listLeaveRequests } from "@/actions/leave";
import { LeaveManager } from "./LeaveManager";

export const metadata: Metadata = { title: "Leave" };

export default async function LeavePage() {
  const user = await requireUser();

  const [result, employees, departments] = await Promise.all([
    listLeaveRequests(),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, nameEn: true, nameKh: true, employeeCode: true, departmentId: true },
      orderBy: { nameEn: "asc" },
    }),
    prisma.department.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!result.ok) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Leave</h1>
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>
          Failed to load leave requests: {result.error}
        </div>
      </div>
    );
  }

  const rows = result.data.map((r) => ({
    id: Number(r.id),
    employeeId: r.employeeId,
    type: r.type as string,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    halfDay: r.halfDay,
    status: r.status as string,
    reason: r.reason,
    rejectionReason: r.rejectionReason,
    decidedById: r.decidedById,
    createdAt: r.createdAt.toISOString(),
    employee: {
      id: r.employee.id,
      nameEn: r.employee.nameEn,
      nameKh: r.employee.nameKh,
      employeeCode: r.employee.employeeCode,
      departmentId: r.employee.departmentId,
      department: r.employee.department,
    },
  }));

  const canRequest = can(user.role, "leave.request");
  const canApprove = can(user.role, "leave.approve");
  const canManage  = user.role === "OWNER" || user.role === "HR_MANAGER";

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Leave</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
          Manage employee leave requests, balances, and reports
        </p>
      </div>
      <LeaveManager
        rows={rows}
        employees={employees}
        departments={departments}
        canRequest={canRequest}
        canApprove={canApprove}
        canManage={canManage}
        actorDeptId={user.departmentId}
      />
    </div>
  );
}
