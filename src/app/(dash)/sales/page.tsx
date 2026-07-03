import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { getSalesSummary } from "@/actions/sales";
import { SalesDashboard } from "./SalesDashboard";

export const metadata: Metadata = { title: "Sales" };

export default async function SalesPage() {
  const user = await requireUser();
  const result = await getSalesSummary();

  if ("error" in result) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Sales</h1>
        <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>{result.error}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Sales & CRM</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Customers, quotations, orders and deliveries</p>
      </div>
      <SalesDashboard
        summary={result.data}
        canManage={can(user.role, "sales.manage")}
        canApprove={can(user.role, "sales.approve")}
      />
    </div>
  );
}
