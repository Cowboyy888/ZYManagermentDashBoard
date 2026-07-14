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
  const canEdit = can(user.role, "employee.update");

  // Destructure all Date/Decimal/nested-with-Date fields out before passing to Client Component.
  // Next.js cannot serialize Date objects across the server→client boundary.
  const {
    createdAt: _ca, updatedAt: _ua,
    birthday: _bd, hireDate: _hd, contractExpiry: _ce, probationEnd: _pe,
    dailyRateUsd: _dr,
    position: rawPos, factoryArea: rawFa, department: rawDept,
    attendance: rawAtt, overtime: rawOt, documents: rawDocs,
    ...empBase
  } = res.data;

  const safeEmp = {
    ...empBase,
    dailyRateUsd: Number(res.data.dailyRateUsd),
    emergencyContact: res.data.emergencyContact as { name?: string; phone?: string; relation?: string } | null,
    birthday: _bd ? _bd.toISOString() : null,
    hireDate: _hd.toISOString(),
    contractExpiry: _ce ? _ce.toISOString() : null,
    probationEnd: _pe ? _pe.toISOString() : null,
    department: rawDept ? { id: rawDept.id, name: rawDept.name } : null,
    position: rawPos ? { id: rawPos.id, name: rawPos.name } : null,
    factoryArea: rawFa ? { id: rawFa.id, name: rawFa.name, code: rawFa.code } : null,
    attendance: rawAtt.map(a => ({
      id: Number(a.id),
      date: a.date.toISOString(),
      am: a.am,
      pm: a.pm,
    })),
    overtime: rawOt.map(o => ({
      id: Number(o.id),
      date: o.date.toISOString(),
      hours: Number(o.hours),
      amountUsd: Number(o.amountUsd),
      band: o.band,
      description: o.description,
    })),
    documents: rawDocs.map(d => ({
      id: Number(d.id),
      type: d.type,
      filename: d.filename,
      url: d.url,
      fileSize: d.fileSize ?? null,
      mimeType: d.mimeType ?? null,
      expiryDate: d.expiryDate ? d.expiryDate.toISOString() : null,
      notes: d.notes ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
  };

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <nav style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-3)" }}>
        <Link href="/employees" style={{ color: "var(--text-3)", textDecoration: "none" }}>Employees</Link>
        <span>/</span>
        <span style={{ color: "var(--text)" }}>{res.data.nameEn}</span>
      </nav>

      <EmployeeProfileClient
        emp={safeEmp}
        canEdit={canEdit}
        positions={positions.map(p => ({ id: p.id, name: p.name, level: p.level }))}
        factoryAreas={factoryAreas.map(a => ({ id: a.id, name: a.name, code: a.code }))}
        departments={departments}
        supervisors={supervisors}
      />
    </div>
  );
}
