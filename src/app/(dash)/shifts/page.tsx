import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { ShiftsClient } from "./ShiftsClient";

export const metadata = { title: "Shift Management — ZY Steel HR" };

export default async function ShiftsPage() {
  const user = await requireUser();

  const [shifts, employees, departments] = await Promise.all([
    prisma.shift.findMany({
      orderBy: [{ active: "desc" }, { shiftType: "asc" }, { name: "asc" }],
      include: { _count: { select: { assignments: true } } },
    }),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ department: { name: "asc" } }, { nameEn: "asc" }],
      select: {
        id: true, employeeCode: true, nameEn: true, nameKh: true,
        departmentId: true, positionId: true,
        department: { select: { name: true } },
        position:   { select: { name: true } },
      },
    }),
    prisma.department.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>
          Shift Management
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
          Create and manage work shifts, assign employees, and view shift schedules.
        </p>
      </div>
      <ShiftsClient
        initialShifts={shifts.map(s => ({
          id: s.id,
          code: s.code,
          name: s.name,
          description: s.description,
          shiftType: s.shiftType,
          startTime: s.startTime,
          endTime: s.endTime,
          breakStart: s.breakStart,
          breakEnd: s.breakEnd,
          workingHours: Number(s.workingHours),
          otStartsAfter: s.otStartsAfter,
          gracePeriodMin: s.gracePeriodMin,
          color: s.color,
          active: s.active,
          assignmentCount: s._count.assignments,
        }))}
        employees={employees.map(e => ({
          id: e.id,
          employeeCode: e.employeeCode,
          nameEn: e.nameEn,
          nameKh: e.nameKh,
          departmentId: e.departmentId,
          departmentName: e.department?.name ?? null,
          positionName: e.position?.name ?? null,
        }))}
        departments={departments}
        canWrite={can(user.role, "attendance.write")}
      />
    </div>
  );
}
