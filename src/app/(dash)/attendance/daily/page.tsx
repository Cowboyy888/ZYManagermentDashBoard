import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { DailyAttendanceClient } from "./DailyAttendanceClient";

export const metadata = { title: "Daily Attendance — ZY Steel HR" };

export default async function DailyAttendancePage() {
  const user = await requireUser();

  const isSupervisor = user.role === "SUPERVISOR" && !!user.departmentId;

  const [departments, positions] = await Promise.all([
    prisma.department.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.position.findMany({
      where: { active: true },
      orderBy: [{ level: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>
          Daily Attendance
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
          Record and manage employee attendance for any date. Use ‹ › to navigate days, or pick a date directly.
        </p>
      </div>
      <DailyAttendanceClient
        departments={departments}
        positions={positions}
        canWrite={can(user.role, "attendance.write")}
        defaultDeptId={isSupervisor ? user.departmentId! : null}
      />
    </div>
  );
}
