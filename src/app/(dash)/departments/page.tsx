import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listDepartmentsManage } from "@/actions/departments";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
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
    return (
      <div style={{ padding: 24 }}>
        <Alert level="error" title="Failed to load departments" message={"error" in deptRes ? deptRes.error : "Unknown error"} />
      </div>
    );
  }

  const activeCount    = deptRes.data.filter(d => d.active).length;
  const archivedCount  = deptRes.data.filter(d => !d.active).length;
  const totalEmployees = deptRes.data.reduce((s, d) => s + d.employeeCount, 0);

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="Departments"
        subtitle={`${activeCount} active · ${archivedCount} archived · ${totalEmployees} total employees`}
      />
      <DepartmentsClient
        departments={deptRes.data}
        employees={employees}
        canEdit={can(user.role, "employee.create")}
        canDelete={can(user.role, "employee.delete")}
      />
    </div>
  );
}
