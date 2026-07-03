import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { getInventorySummary } from "@/actions/inventory";
import { InventoryDashboard } from "./InventoryDashboard";

export const metadata: Metadata = { title: "Inventory Overview" };

export default async function InventoryPage() {
  const user = await requireUser();
  const res  = await getInventorySummary();

  if (!res.ok) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Inventory</h1>
        <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>
          {res.error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Inventory Overview</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
          Warehouse stock, valuation, low-stock alerts, and recent movements
        </p>
      </div>
      <InventoryDashboard summary={res.data} canWrite={can(user.role, "inventory.write")} />
    </div>
  );
}
