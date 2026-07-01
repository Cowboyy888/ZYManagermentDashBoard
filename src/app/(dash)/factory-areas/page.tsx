import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { FactoryAreasClient } from "./FactoryAreasClient";

export default async function FactoryAreasPage() {
  const user = await requireUser();
  const areas = await prisma.factoryArea.findMany({
    orderBy: { code: "asc" },
    include: { _count: { select: { employees: { where: { status: "ACTIVE" } } } } },
  });

  return (
    <div style={{ padding: 24 }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Factory Areas</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>Manage production zones, warehouses, and office spaces</p>
      </header>
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
