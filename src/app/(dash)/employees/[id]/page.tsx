import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getEmployee } from "@/actions/employees";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { EmployeeProfileClient } from "./EmployeeProfileClient";

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (isNaN(id)) notFound();

  const user = await requireUser();
  const [res, positions, factoryAreas, departments, supervisors] = await Promise.all([
    getEmployee(id),
    prisma.position.findMany({ orderBy: [{ level: "asc" }, { name: "asc" }] }),
    prisma.factoryArea.findMany({ orderBy: { code: "asc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, nameEn: true, nameKh: true },
      orderBy: { nameEn: "asc" },
    }),
  ]);

  if (!res.ok || !res.data) notFound();
  const emp = res.data;
  const canEdit = can(user.role, "employee.update");

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      {/* Breadcrumb */}
      <nav style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-3)" }}>
        <Link href="/employees" style={{ color: "var(--text-3)", textDecoration: "none" }}>Employees</Link>
        <span>/</span>
        <span style={{ color: "var(--text)" }}>{emp.nameEn}</span>
      </nav>

      <EmployeeProfileClient
        emp={{
          ...emp,
          dailyRateUsd: Number(emp.dailyRateUsd),
          emergencyContact: emp.emergencyContact as { name?: string; phone?: string; relation?: string } | null,
          birthday: emp.birthday ? emp.birthday.toISOString() : null,
          hireDate: emp.hireDate.toISOString(),
          contractExpiry: emp.contractExpiry ? emp.contractExpiry.toISOString() : null,
          probationEnd: emp.probationEnd ? emp.probationEnd.toISOString() : null,
          attendance: emp.attendance.map(a => ({
            ...a,
            id: Number(a.id),
            date: a.date.toISOString(),
          })),
          overtime: emp.overtime.map(o => ({
            ...o,
            id: Number(o.id),
            hours: Number(o.hours),
            amountUsd: Number(o.amountUsd),
            date: o.date.toISOString(),
          })),
          documents: emp.documents.map(d => ({
            ...d,
            id: Number(d.id),
            fileSize: d.fileSize ?? null,
            expiryDate: d.expiryDate ? d.expiryDate.toISOString() : null,
            createdAt: d.createdAt.toISOString(),
          })),
        }}
        canEdit={canEdit}
        positions={positions.map(p => ({ id: p.id, name: p.name, level: p.level }))}
        factoryAreas={factoryAreas.map(a => ({ id: a.id, name: a.name, code: a.code }))}
        departments={departments}
        supervisors={supervisors}
      />
    </div>
  );
}
