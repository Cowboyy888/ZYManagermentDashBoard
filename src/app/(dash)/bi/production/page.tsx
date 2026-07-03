import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { getProductionAnalytics } from "@/actions/bi";
import { ProductionAnalytics } from "./ProductionAnalytics";

export const metadata: Metadata = { title: "Production Analytics" };

export default async function ProductionAnalyticsPage() {
  const user = await requireUser();
  if (!can(user.role, "bi.read")) return <div style={{ padding: 24, color: "var(--red)" }}>Access denied.</div>;

  const result = await getProductionAnalytics(90);
  const data = result.ok ? result.data : null;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Production Analytics</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Daily output, downtime analysis, machine utilization and order pipeline</p>
      </div>
      {!data ? (
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>
          {"error" in result ? result.error : "Failed to load data"}
        </div>
      ) : <ProductionAnalytics data={data} />}
    </div>
  );
}
