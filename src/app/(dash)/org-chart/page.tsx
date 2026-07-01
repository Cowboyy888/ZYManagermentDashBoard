import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { OrgChartClient } from "./OrgChartClient";

export default async function OrgChartPage() {
  await requireUser();

  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true, nameEn: true, nameKh: true,
      employeeCode: true, photoUrl: true,
      supervisorId: true,
      position: { select: { name: true } },
      department: { select: { name: true } },
      factoryArea: { select: { code: true } },
    },
    orderBy: { nameEn: "asc" },
  });

  type EmpNode = {
    id: number; nameEn: string; nameKh: string;
    employeeCode: string | null; photoUrl: string | null;
    position: { name: string } | null;
    department: { name: string } | null;
    factoryArea: { code: string } | null;
    children: EmpNode[];
  };

  // Build tree
  const map = new Map<number, EmpNode>();
  employees.forEach(e => map.set(e.id, { ...e, children: [] }));

  const roots: EmpNode[] = [];
  employees.forEach(e => {
    const node = map.get(e.id)!;
    if (e.supervisorId && map.has(e.supervisorId)) {
      map.get(e.supervisorId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return (
    <div style={{ padding: 24 }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Organization Chart</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>Reporting hierarchy based on supervisor assignments</p>
      </header>
      <OrgChartClient roots={roots} totalCount={employees.length} />
    </div>
  );
}
