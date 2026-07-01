import { requireUser } from "@/lib/auth/session";
import { listEmployees } from "@/actions/employees";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { EmployeeManager } from "./EmployeeManager";

export default async function EmployeesPage() {
  const user = await requireUser();
  const [res, departments, positions, factoryAreas, supervisorRaw] = await Promise.all([
    listEmployees({ status: "ACTIVE" }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.position.findMany({ orderBy: [{ level: "asc" }, { name: "asc" }] }),
    prisma.factoryArea.findMany({ orderBy: { code: "asc" } }),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, nameEn: true, nameKh: true },
      orderBy: { nameEn: "asc" },
    }),
  ]);

  if ('error' in res) return <p style={{ padding: 24, color: "var(--red)" }}>{res.error}</p>;

  const rows = res.data.map(e => ({
    id: e.id,
    nameEn: e.nameEn,
    nameKh: e.nameKh,
    nameZh: e.nameZh,
    employeeCode: e.employeeCode,
    photoUrl: e.photoUrl,
    dailyRateUsd: Number(e.dailyRateUsd),
    department: e.department,
    position: e.position,
    factoryArea: e.factoryArea,
    shift: e.shift,
    status: e.status,
  }));

  return (
    <div style={{ padding: 24 }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Employees</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>{rows.length} active employees</p>
      </header>
      <EmployeeManager
        initial={rows}
        departments={departments}
        positions={positions.map(p => ({ id: p.id, name: p.name, level: p.level }))}
        factoryAreas={factoryAreas.map(a => ({ id: a.id, name: a.name, code: a.code }))}
        supervisors={supervisorRaw}
        canEdit={can(user.role, "employee.create")}
      />
    </div>
  );
}
