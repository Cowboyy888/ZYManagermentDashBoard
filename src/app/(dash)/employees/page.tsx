import { requireUser } from "@/lib/auth/session";
import { listEmployees } from "@/actions/employees";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { EmployeeManager } from "./EmployeeManager";

export default async function EmployeesPage() {
  const user = await requireUser();
  const [res, departments, positions, factoryAreas, supervisorRaw] = await Promise.all([
    // Load all statuses so the client-side filter can switch between Active / All / Terminated
    listEmployees({ status: "ALL" }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.position.findMany({ orderBy: [{ level: "asc" }, { name: "asc" }] }),
    prisma.factoryArea.findMany({ orderBy: { code: "asc" } }),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, nameEn: true, nameKh: true },
      orderBy: { nameEn: "asc" },
    }),
  ]);

  if (!res.ok) return <p style={{ padding: 24, color: "var(--red)" }}>{"error" in res ? res.error : "Failed to load"}</p>;

  const rows = res.data.map(e => ({
    id: e.id,
    nameEn: e.nameEn,
    nameKh: e.nameKh,
    nameZh: e.nameZh,
    employeeCode: e.employeeCode,
    photoUrl: e.photoUrl,
    dailyRateUsd: Number(e.dailyRateUsd),
    hireDate: e.hireDate.toISOString(),
    departmentId: e.departmentId ?? null,
    department: e.department ? { id: e.department.id, name: e.department.name } : null,
    position: e.position ? { name: e.position.name } : null,
    factoryArea: e.factoryArea ? { name: e.factoryArea.name, code: e.factoryArea.code } : null,
    shift: e.shift,
    status: e.status as "ACTIVE" | "TERMINATED",
  }));

  const activeCount = rows.filter(r => r.status === "ACTIVE").length;

  return (
    <div style={{ padding: 24 }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Employees</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>
          {activeCount} active · {rows.length} total
        </p>
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
