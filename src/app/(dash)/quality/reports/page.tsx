import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listInspections, listNCRs, listCAPAs, listCertificates } from "@/actions/quality";
import { QualityReports } from "./QualityReports";

export const metadata: Metadata = { title: "Quality Reports" };

export default async function QualityReportsPage() {
  const user = await requireUser();

  const [inspResult, ncrResult, capaResult, certResult] = await Promise.all([
    listInspections({ days: 180, limit: 1000 }),
    listNCRs({ limit: 500 }),
    listCAPAs({ limit: 500 }),
    listCertificates({ limit: 300 }),
  ]);

  const inspections = inspResult.ok ? inspResult.data.map((i) => ({
    id: i.id,
    inspectionNumber: i.inspectionNumber,
    type: i.type as string,
    status: i.status as string,
    result: i.result as string | null,
    inspectionDate: (i.inspectionDate as Date).toISOString(),
    sampleSize: i.sampleSize,
    defectCount: i.defectCount,
    productDescription: i.productDescription,
    batchNumber: i.batchNumber,
    orderCode: i.productionOrder?.orderCode ?? null,
  })) : [];

  const ncrs = ncrResult.ok ? ncrResult.data.map((n) => ({
    id: n.id,
    ncrNumber: n.ncrNumber,
    defectType: n.defectType,
    severity: n.severity,
    status: n.status as string,
    createdAt: n.createdAt.toISOString(),
    dueDate: n.dueDate ? (n.dueDate as Date).toISOString() : null,
    closedAt: n.closedAt?.toISOString() ?? null,
  })) : [];

  const capas = capaResult.ok ? capaResult.data.map((c) => ({
    id: c.id,
    actionType: c.actionType,
    status: c.status,
    dueDate: c.dueDate ? (c.dueDate as Date).toISOString() : null,
    completedAt: c.completedAt?.toISOString() ?? null,
    ncrSeverity: c.ncr.severity,
    createdAt: c.createdAt.toISOString(),
  })) : [];

  const certificates = certResult.ok ? certResult.data.map((c) => ({
    id: c.id,
    certificateNumber: c.certificateNumber,
    type: c.type as string,
    customerName: c.customer?.name ?? null,
    issuedDate: (c.issuedDate as Date).toISOString(),
  })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Quality Reports</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Defect analysis, inspection trends and quality KPIs</p>
      </div>
      <QualityReports
        inspections={inspections}
        ncrs={ncrs}
        capas={capas}
        certificates={certificates}
        canExport={can(user.role, "report.export")}
      />
    </div>
  );
}
