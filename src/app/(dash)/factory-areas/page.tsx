import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { FactoryAreasClient } from "./FactoryAreasClient";

export default async function FactoryAreasPage() {
  const user = await requireUser();
  const areas = await prisma.factoryArea.findMany({
    orderBy: { code: "asc" },
    include: { _count: { select: { employees: { where: { status: "ACTIVE" } } } } },
  });

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="Factory Areas"
        subtitle="Manage production zones, warehouses, and office spaces"
      />
      <FactoryAreasClient
        areas={areas.map(a => ({
          id: a.id, name: a.name, code: a.code,
          description: a.description,
          employeeCount: a._count.employees,
        }))}
        canEdit={can(user.role, "employee.create")}
      />
    </div>
  );
}
