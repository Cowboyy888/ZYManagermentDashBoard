import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listCAPAs, listNCRs } from "@/actions/quality";
import { prisma } from "@/lib/db";
import { CAPAManager } from "./CAPAManager";

export const metadata: Metadata = { title: "CAPA" };

export default async function CAPAPage() {
  const user = await requireUser();

  const [capaResult, ncrResult, users] = await Promise.all([
    listCAPAs({ limit: 300 }),
    listNCRs({ limit: 200 }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const capas = capaResult.ok ? capaResult.data.map((c) => ({
    id: c.id,
    ncrId: c.ncrId,
    ncrNumber: c.ncr.ncrNumber,
    defectType: c.ncr.defectType,
    ncrSeverity: c.ncr.severity,
    actionType: c.actionType,
    description: c.description,
    assignedToId: c.assignedToId,
    assignedToName: c.assignedTo?.name ?? null,
    dueDate: c.dueDate ? (c.dueDate as Date).toISOString() : null,
    completedAt: c.completedAt?.toISOString() ?? null,
    status: c.status,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
  })) : [];

  const openNCRs = ncrResult.ok ? ncrResult.data
    .filter((n) => !["CLOSED", "CANCELLED"].includes(n.status))
    .map((n) => ({ id: n.id, ncrNumber: n.ncrNumber, defectType: n.defectType })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Corrective & Preventive Actions</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>CAPA tracking linked to non-conformance reports</p>
      </div>
      <CAPAManager
        capas={capas}
        openNCRs={openNCRs}
        users={users}
        canWrite={can(user.role, "quality.write")}
      />
    </div>
  );
}
