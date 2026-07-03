import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { getQualitySummary } from "@/actions/quality";
import { QualityDashboard } from "./QualityDashboard";

export const metadata: Metadata = { title: "Quality Management" };

export default async function QualityPage() {
  const user = await requireUser();
  const result = await getQualitySummary();

  if ("error" in result) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Quality Management</h1>
        <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>{result.error}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Quality Management System</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Inspections, non-conformance, CAPA and quality certificates</p>
      </div>
      <QualityDashboard
        summary={result.data}
        canManage={can(user.role, "quality.manage")}
        canApprove={can(user.role, "quality.approve")}
      />
    </div>
  );
}
