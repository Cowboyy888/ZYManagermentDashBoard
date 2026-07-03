import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { getInventorySummary } from "@/actions/inventory";
import { InventoryAnalytics } from "./InventoryAnalytics";

export const metadata: Metadata = { title: "Inventory Analytics" };

export default async function InventoryAnalyticsPage() {
  const user = await requireUser();
  if (!can(user.role, "bi.read")) return <div style={{ padding: 24, color: "var(--red)" }}>Access denied.</div>;

  const result = await getInventorySummary();
  const data = result.ok ? result.data : null;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Inventory Analytics</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Stock valuation, category breakdown, low-stock analysis and transaction trends</p>
      </div>
      {!data ? (
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>
          {result.ok ? "" : result.error}
        </div>
      ) : <InventoryAnalytics data={data} />}
    </div>
  );
}
