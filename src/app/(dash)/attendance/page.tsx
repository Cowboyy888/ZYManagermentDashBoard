import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { AttendanceManager } from "./AttendanceManager";

export default async function AttendancePage() {
  const user = await requireUser();

  const isSupervisor = user.role === "SUPERVISOR" && !!user.departmentId;

  const [employees, departments, positions] = await Promise.all([
    prisma.employee.findMany({
      where: {
        status: "ACTIVE",
        ...(isSupervisor ? { departmentId: user.departmentId! } : {}),
      },
      orderBy: { nameEn: "asc" },
      select: {
        id: true, nameEn: true, nameKh: true, nameZh: true,
        photoUrl: true, departmentId: true, positionId: true,
      },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.position.findMany({ orderBy: [{ level: "asc" }, { name: "asc" }], select: { id: true, name: true, level: true } }),
  ]);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Attendance</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
          Click any cell to cycle √ / △ / ×, then Save — or use the Summary tab for reports and exports.
        </p>
      </div>
      <AttendanceManager
        employees={employees}
        departments={departments}
        positions={positions}
        canWrite={can(user.role, "attendance.write")}
      />
    </div>
  );
}
