import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { getPurchasingSummary } from "@/actions/purchasing";
import { PurchasingAnalytics } from "./PurchasingAnalytics";

export const metadata: Metadata = { title: "Purchasing Analytics" };

export default async function PurchasingAnalyticsPage() {
  const user = await requireUser();
  if (!can(user.role, "bi.read")) return <div style={{ padding: 24, color: "var(--red)" }}>Access denied.</div>;

  const result = await getPurchasingSummary();
  const data = "error" in result ? null : result.data;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Purchasing Analytics</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Supplier performance, spend trends, PO pipeline and low-stock purchasing needs</p>
      </div>
      {!data ? (
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>
          {"error" in result ? result.error : "No data"}
        </div>
      ) : <PurchasingAnalytics data={data} />}
    </div>
  );
}
