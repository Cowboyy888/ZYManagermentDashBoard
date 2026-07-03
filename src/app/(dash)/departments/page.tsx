import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listDepartmentsManage } from "@/actions/departments";
import { prisma } from "@/lib/db";
import { DepartmentsClient } from "./DepartmentsClient";

export default async function DepartmentsPage() {
  const user = await requireUser();

  const [deptRes, employees] = await Promise.all([
    listDepartmentsManage(),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, nameEn: true, nameKh: true },
      orderBy: { nameEn: "asc" },
    }),
  ]);

  if (!deptRes.ok) {
    return <p style={{ padding: 24, color: "var(--red)" }}>{"error" in deptRes ? deptRes.error : "Failed to load"}</p>;
  }

  const activeCount  = deptRes.data.filter(d => d.active).length;
  const archivedCount = deptRes.data.filter(d => !d.active).length;
  const totalEmployees = deptRes.data.reduce((s, d) => s + d.employeeCount, 0);

  return (
    <div style={{ padding: 24 }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
          Departments
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>
          {activeCount} active · {archivedCount} archived · {totalEmployees} total employees
        </p>
      </header>
      <DepartmentsClient
        departments={deptRes.data}
        employees={employees}
        canEdit={can(user.role, "employee.create")}
        canDelete={can(user.role, "employee.delete")}
      />
    </div>
  );
}
