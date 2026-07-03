import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { getMaintenanceSummary } from "@/actions/maintenance";
import { MaintenanceDashboard } from "./MaintenanceDashboard";

export const metadata: Metadata = { title: "Maintenance (CMMS)" };

export default async function MaintenancePage() {
  const user = await requireUser();
  const result = await getMaintenanceSummary();

  if ("error" in result) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Maintenance (CMMS)</h1>
        <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>{result.error}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Maintenance Dashboard</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Machine status, work orders, PM compliance and maintenance costs</p>
      </div>
      <MaintenanceDashboard
        summary={result.data}
        canManage={can(user.role, "maintenance.manage")}
      />
    </div>
  );
}
