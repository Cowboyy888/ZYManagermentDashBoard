import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { getProductionSummary } from "@/actions/production";
import { ProductionDashboard } from "./ProductionDashboard";

export const metadata: Metadata = { title: "Production Overview" };

export default async function ProductionPage() {
  const user = await requireUser();
  const res  = await getProductionSummary();

  if (!res.ok) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Production Overview</h1>
        <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>
          {res.error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Production Overview</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
          Factory operations at a glance — output, orders, machines, quality
        </p>
      </div>
      <ProductionDashboard
        summary={res.data}
        canManage={can(user.role, "production.manage")}
      />
    </div>
  );
}
