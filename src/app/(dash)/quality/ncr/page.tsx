import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listNCRs, listInspections } from "@/actions/quality";
import { prisma } from "@/lib/db";
import { NCRManager } from "./NCRManager";

export const metadata: Metadata = { title: "Non-Conformance Reports" };

export default async function NCRPage() {
  const user = await requireUser();

  const [ncrResult, inspResult, employees] = await Promise.all([
    listNCRs({ limit: 300 }),
    listInspections({ limit: 200 }),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, nameEn: true },
      orderBy: { nameEn: "asc" },
    }),
  ]);

  const ncrs = ncrResult.ok ? ncrResult.data.map((n) => ({
    id: n.id,
    ncrNumber: n.ncrNumber,
    inspectionId: n.inspectionId,
    inspectionNumber: n.inspection?.inspectionNumber ?? null,
    defectType: n.defectType,
    defectDescription: n.defectDescription,
    severity: n.severity,
    rootCause: n.rootCause,
    status: n.status as string,
    responsibleId: n.responsibleId,
    responsibleName: n.responsible?.nameEn ?? null,
    dueDate: n.dueDate ? (n.dueDate as Date).toISOString() : null,
    closedAt: n.closedAt?.toISOString() ?? null,
    createdBy: n.createdBy.name,
    capaCount: n._count.correctiveActions,
    createdAt: n.createdAt.toISOString(),
  })) : [];

  const inspections = inspResult.ok ? inspResult.data.map((i) => ({
    id: i.id, inspectionNumber: i.inspectionNumber, type: i.type as string,
  })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Non-Conformance Reports</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Track defects, root causes and resolution status</p>
      </div>
      <NCRManager
        ncrs={ncrs}
        inspections={inspections}
        employees={employees}
        canWrite={can(user.role, "quality.write")}
        canApprove={can(user.role, "quality.approve")}
      />
    </div>
  );
}
