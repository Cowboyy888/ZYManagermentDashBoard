import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { getPurchasingSummary } from "@/actions/purchasing";
import { PurchasingDashboard } from "./PurchasingDashboard";

export const metadata: Metadata = { title: "Purchasing" };

export default async function PurchasingPage() {
  const user = await requireUser();
  const result = await getPurchasingSummary();

  if ("error" in result) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Purchasing</h1>
        <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>{result.error}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Purchasing & Procurement</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Purchase orders, suppliers, requisitions and goods receiving</p>
      </div>
      <PurchasingDashboard
        summary={result.data}
        canManage={can(user.role, "purchasing.manage")}
        canApprove={can(user.role, "purchasing.approve")}
      />
    </div>
  );
}
