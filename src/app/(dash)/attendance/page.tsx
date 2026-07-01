import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { AttendanceManager } from "./AttendanceManager";

export default async function AttendancePage() {
  const user = await requireUser();
  const [employees, departments] = await Promise.all([
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      ...(user.role === "SUPERVISOR" && user.departmentId ? { where: { status: "ACTIVE", departmentId: user.departmentId } } : {}),
      orderBy: { id: "asc" },
      select: { id: true, nameEn: true, nameKh: true, nameZh: true },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Attendance</h1>
        <p className="text-sm text-gray-500 mt-0.5">Click any cell to cycle √ / △ / ×, then Save</p>
      </div>
      <AttendanceManager
        employees={employees}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        canWrite={can(user.role, "attendance.write")}
      />
    </div>
  );
}
